const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbypYqkxIIMDWaF7heSyxzygLEoE_2FMrvRYuESdLwOyBMKlcTInLpjlu8ebSEp7wXQwqg/exec';


function sanitizeHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'link', 'style', 'meta', 'base', 'applet'];
  dangerousTags.forEach(tag => {
    doc.querySelectorAll(tag).forEach(el => el.remove());
  });
  doc.querySelectorAll('*').forEach(el => {
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on') || (attr.value && attr.value.trim().toLowerCase().startsWith('javascript:'))) {
        el.removeAttribute(attr.name);
      }
    }
    ['href', 'src', 'action', 'formaction', 'data'].forEach(attrName => {
      const val = el.getAttribute(attrName);
      if (val && val.trim().toLowerCase().startsWith('javascript:')) {
        el.removeAttribute(attrName);
      }
    });
  });
  return doc.body.innerHTML;
}

function validateInput(value, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().substring(0, maxLength);
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

class API {
  static _pendingRequests = {};

  static async request(method, data = {}, showLoader = true) {
    if (showLoader) showLoading();
    try {
      let url = SCRIPT_URL;
      let options = { redirect: 'follow' };

      if (method === 'GET') {
        const queryParams = new URLSearchParams(data).toString();
        url = `${SCRIPT_URL}?${queryParams}`;
        options.method = 'GET';
      } else {
        options.method = 'POST';
        options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
        
        // Attach session token for authenticated requests
        const token = Auth.getToken();
        const securedData = { ...data };
        if (token) {
          securedData._token = token;
        }
        options.body = JSON.stringify(securedData);
      }

      const response = await fetch(url, options);
      const result = await response.json();
      hideLoading();
      
      // If server says session expired, clear session and redirect to login
      if (!result.success && result.message && result.message.includes('invalid or expired session')) {
        Auth.clearSession();
        return result;
      }
      
      return result;
    } catch (error) {
      hideLoading();
      console.error("API Error:", error);
      return { success: false, message: 'Network error or invalid response.' };
    }
  }

  static CACHE_DURATION = 1000 * 60 * 5;

  static async getPosts(forceRefresh = false) {
    const cacheKey = 'posts_cache';
    const cached = sessionStorage.getItem(cacheKey);
    const cacheTime = sessionStorage.getItem(cacheKey + '_time');

    if (!forceRefresh && cached && (Date.now() - cacheTime < this.CACHE_DURATION)) {
      return JSON.parse(cached);
    }


    if (this._pendingRequests[cacheKey]) {
      return this._pendingRequests[cacheKey];
    }

    this._pendingRequests[cacheKey] = (async () => {
      const res = await this.request('GET', { action: 'get_posts' });
      if (res.success) {
        sessionStorage.setItem(cacheKey, JSON.stringify(res));
        sessionStorage.setItem(cacheKey + '_time', Date.now());
      }
      delete this._pendingRequests[cacheKey];
      return res;
    })();

    return this._pendingRequests[cacheKey];
  }

  static async getPostById(id) {
    return this.request('GET', { action: 'get_posts', post_id: id });
  }

  static async getUsers(forceRefresh = false) {
    const cacheKey = 'users_cache';
    const cached = sessionStorage.getItem(cacheKey);
    const cacheTime = sessionStorage.getItem(cacheKey + '_time');

    if (!forceRefresh && cached && (Date.now() - cacheTime < this.CACHE_DURATION)) {
      return JSON.parse(cached);
    }

    // Uses POST with session token — server verifies admin role from token
    const res = await this.request('POST', { action: 'get_users' });
    if (res.success) {
      sessionStorage.setItem(cacheKey, JSON.stringify(res));
      sessionStorage.setItem(cacheKey + '_time', Date.now());
    }
    return res;
  }

  static clearCache() {
    sessionStorage.removeItem('posts_cache');
    sessionStorage.removeItem('posts_cache_time');
    sessionStorage.removeItem('users_cache');
    sessionStorage.removeItem('users_cache_time');
  }

  static async login(username, password) {
    return this.request('POST', { action: 'login', username, password });
  }

  static async register(username, email, password) {
    return this.request('POST', { action: 'register', username, email, password });
  }

  static async createPost(postData) {
    this.clearCache();
    postData.title = validateInput(postData.title, 200);
    postData.category = validateInput(postData.category, 100);
    postData.thumbnail = validateInput(postData.thumbnail, 1000);
    if (postData.content) postData.content = sanitizeHTML(postData.content);
    // Don't send author_id/author_name — server determines identity from token
    return this.request('POST', { action: 'create_post', title: postData.title, category: postData.category, thumbnail: postData.thumbnail, content: postData.content });
  }

  static async updatePost(postData) {
    this.clearCache();
    if (postData.title) postData.title = validateInput(postData.title, 200);
    if (postData.category) postData.category = validateInput(postData.category, 100);
    if (postData.thumbnail) postData.thumbnail = validateInput(postData.thumbnail, 1000);
    if (postData.content) postData.content = sanitizeHTML(postData.content);
    // Don't send user_id — server determines identity from token
    return this.request('POST', { action: 'update_post', id: postData.id, title: postData.title, category: postData.category, thumbnail: postData.thumbnail, content: postData.content });
  }

  static async deletePost(id) {
    this.clearCache();
    // Don't send user_id — server determines identity from token
    return this.request('POST', { action: 'delete_post', id });
  }

  static async deleteUser(id) {
    this.clearCache();
    // Don't send admin_id — server determines identity from token
    return this.request('POST', { action: 'delete_user', id });
  }

  static async cleanupSpam() {
    this.clearCache();
    // Don't send admin_id — server determines identity from token
    return this.request('POST', { action: 'cleanup_spam' });
  }

  static async updateProfile(profileData) {
    if (profileData.avatar && profileData.avatar.trim() !== '') {
      const url = profileData.avatar.trim().toLowerCase();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { success: false, message: 'Avatar URL must start with http:// or https://' };
      }
    }
    if (profileData.bio) {
      profileData.bio = profileData.bio.substring(0, 500);
    }
    // Don't send id — server determines identity from token
    return this.request('POST', { action: 'update_profile', bio: profileData.bio, avatar: profileData.avatar });
  }

  static async logout() {
    return this.request('POST', { action: 'logout' }, false);
  }
}

let _loadingCount = 0;

function showLoading() {
  _loadingCount++;
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.remove('done');
    loader.classList.add('active');
  }
}

function hideLoading() {
  _loadingCount = Math.max(0, _loadingCount - 1);
  if (_loadingCount > 0) return;
  
  const loader = document.getElementById('global-loader');
  if (loader) {
    loader.classList.remove('active');
    loader.classList.add('done');

    setTimeout(() => {
      if (!loader.classList.contains('active')) {
        loader.classList.remove('done');
        loader.style.width = '0%';
      }
    }, 600);
  }
}

function showToast(icon, title, text = '') {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      icon: icon,
      title: title,
      text: text,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  } else {
    alert(`${title}: ${text}`);
  }
}

class Auth {
  static setSession(user, token) {
    localStorage.setItem('fanblog_user', JSON.stringify(user));
    if (token) localStorage.setItem('fanblog_token', token);
  }

  static getSession() {
    try {
      const data = localStorage.getItem('fanblog_user');
      if (!data) return null;
      const parsed = JSON.parse(data);
      if (!parsed || !parsed.id || !parsed.username || !parsed.role) {
        localStorage.removeItem('fanblog_user');
        return null;
      }
      if (!['user', 'admin'].includes(parsed.role)) {
        localStorage.removeItem('fanblog_user');
        return null;
      }
      return parsed;
    } catch (e) {
      localStorage.removeItem('fanblog_user');
      return null;
    }
  }

  static clearSession() {
    const token = localStorage.getItem('fanblog_token');
    if (token) {
      // Invalidate server-side token (fire-and-forget)
      try { API.logout(); } catch(e) {}
    }
    localStorage.removeItem('fanblog_user');
    localStorage.removeItem('fanblog_token');
    window.location.href = '/login';
  }

  static getToken() {
    return localStorage.getItem('fanblog_token') || null;
  }

  static isLoggedIn() {
    return this.getSession() !== null;
  }

  static isAdmin() {
    const user = this.getSession();
    return user && user.role === 'admin';
  }

  static requireLogin() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login';
    }
  }

  static requireAdmin() {
    if (!this.isAdmin()) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'error',
          title: 'Access Denied',
          text: 'Maaf, Anda tidak memiliki izin untuk mengakses halaman ini.',
          confirmButtonColor: 'var(--accent)',
          confirmButtonText: 'Kembali ke Beranda'
        }).then(() => {
          window.location.href = '/';
        });
      } else {
        window.location.href = '/';
      }
    }
  }

  static checkAuthRedirect() {
    if (this.isLoggedIn()) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          icon: 'info',
          title: 'Sudah Login',
          text: 'Anda sudah masuk ke akun Anda.',
          confirmButtonColor: 'var(--accent)',
          confirmButtonText: 'Ke Beranda'
        }).then(() => {
          window.location.href = '/';
        });
      } else {
        window.location.href = '/';
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof AOS !== 'undefined') {
    AOS.init({ once: true, offset: 50 });
  }

  updateNavbar();

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link && Auth.isLoggedIn()) {
      const href = link.getAttribute('href');
      if (href && (href.includes('login') || href.includes('signup'))) {
        e.preventDefault();
        const user = Auth.getSession();
        Swal.fire({
          icon: 'info',
          title: `Halo, ${escapeHTML(user.username)}!`,
          text: 'Anda sudah masuk ke akun Anda. Ingin menulis sesuatu hari ini?',
          showCancelButton: true,
          confirmButtonColor: 'var(--accent)',
          cancelButtonColor: 'var(--stroke)',
          confirmButtonText: '<i class="bi bi-pencil-square me-2"></i> Tulis Postingan',
          cancelButtonText: 'Ke Profil Saya'
        }).then((result) => {
          if (result.isConfirmed) {
            window.location.href = '/create-post';
          } else if (result.dismiss === Swal.DismissReason.cancel) {
            window.location.href = '/profile';
          }
        });
      }
    }
  });
});

function updateNavbar() {
  const user = Auth.getSession();
  const authNav = document.getElementById('auth-nav');
  if (!authNav) return;

  if (user) {
    const safeUsername = escapeHTML(user.username);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff`;
    const safeAvatar = escapeHTML(user.avatar || defaultAvatar);
    let adminLink = user.role === 'admin' ? `<li><a class="dropdown-item" href="/admin"><i class="bi bi-speedometer2 me-2"></i> Dashboard</a></li>` : '';
    
    authNav.innerHTML = `
      <li class="nav-item dropdown">
        <a class="nav-link dropdown-toggle d-flex align-items-center gap-2" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
          <img src="${safeAvatar}" class="rounded-circle-img" alt="Avatar" referrerpolicy="no-referrer" onerror="this.src='${defaultAvatar}'">
          <span>${safeUsername}</span>
        </a>
        <ul class="dropdown-menu dropdown-menu-end shadow border-0" aria-labelledby="navbarDropdown">
          ${adminLink}
          <li><a class="dropdown-item" href="/profile"><i class="bi bi-person me-2"></i> Profil</a></li>
          <li><a class="dropdown-item" href="/create-post"><i class="bi bi-pencil-square me-2"></i> Tulis Postingan</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" onclick="Auth.clearSession()"><i class="bi bi-box-arrow-right me-2"></i> Logout</a></li>
        </ul>
      </li>
    `;
  } else {
    authNav.innerHTML = `
      <li class="nav-item">
        <a class="nav-link" href="/login">Login</a>
      </li>
      <li class="nav-item ms-lg-2 mt-2 mt-lg-0">
        <a class="btn btn-primary w-100" href="/signup">Mulai Sekarang</a>
      </li>
    `;
  }
}

function renderNavbar() {
  return `
  <nav class="navbar navbar-expand-lg sticky-top">
    <div class="container">
      <a class="navbar-brand d-flex align-items-center gap-2" href="/">
        <img src="/assets/img/logo.webp" alt="FanBlog Logo" style="width: 35px; height: 35px; object-fit: contain;"> 
        <span class="fw-bold">FanBlog</span>
      </a>
      <button class="navbar-toggler border-0 shadow-none" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <i class="bi bi-list fs-1"></i>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          <li class="nav-item"><a class="nav-link" href="/">Home</a></li>
          <li class="nav-item"><a class="nav-link" href="/explore">Explore</a></li>
          <li class="nav-item"><a class="nav-link" href="/categories">Categories</a></li>
          <li class="nav-item"><a class="nav-link" href="/trending">Trending</a></li>
          <li class="nav-item"><a class="nav-link" href="/about">About</a></li>
        </ul>
        <ul class="navbar-nav align-items-lg-center gap-2" id="auth-nav">
          <li class="nav-item d-none d-lg-block">
            <a class="nav-link text-primary fw-bold" href="/create-post">
              <i class="bi bi-pencil-square me-1"></i> Write
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
  `;
}

function renderFooter() {
  return `
  <footer class="py-5 mt-5 border-top border-secondary border-opacity-10">
    <div class="container text-center">
      <div class="mb-3">
        <i class="bi bi-feather text-primary fs-4"></i>
      </div>
      <div class="d-flex justify-content-center gap-3 mb-3" style="font-size: 0.85rem;">
        <a href="/faq" class="text-muted text-decoration-none hover-accent">FAQ</a>
        <span class="text-muted opacity-25">|</span>
        <a href="/guidelines" class="text-muted text-decoration-none hover-accent">Guidelines</a>
        <span class="text-muted opacity-25">|</span>
        <a href="/about" class="text-muted text-decoration-none hover-accent">About</a>
      </div>
      <p class="text-muted mb-2" style="font-size: 0.9rem;">&copy; ${new Date().getFullYear()} FanBlog. All rights reserved.</p>
      <p class="text-muted mb-0" style="font-size: 0.85rem;">
        Developed by <a href="https://irfan-syarifudin.vercel.app" target="_blank" rel="noopener noreferrer" class="text-primary text-decoration-none fw-600">Irfan Syarifudin</a>
      </p>
    </div>
  </footer>
  `;
}

function renderLoader() {
  return `<div class="top-loader" id="global-loader"></div>`;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayName = days[d.getDay()];
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${dayName}, ${day}/${month}/${year} - ${hours}:${minutes} WIB`;
}

document.addEventListener('DOMContentLoaded', () => {
  const navbarEl = document.getElementById('navbar-placeholder');
  const footerEl = document.getElementById('footer-placeholder');
  
  if (navbarEl) navbarEl.innerHTML = renderNavbar();
  if (footerEl) footerEl.innerHTML = renderFooter();
  
  document.body.insertAdjacentHTML('beforeend', renderLoader());
  updateNavbar();

  ProgressiveImage.observe();
});

class ProgressiveImage {
  static _observer = null;
  static _observed = new WeakSet();

  static observe() {
    if (!this._observer) {
      this._observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const wrapper = entry.target;
            const img = wrapper.querySelector('img');
            if (img) this._loadImage(wrapper, img);
            this._observer.unobserve(wrapper);
          }
        });
      }, {
        rootMargin: '200px 0px',
        threshold: 0.01
      });
    }

    document.querySelectorAll('.img-progressive').forEach(wrapper => {
      if (!this._observed.has(wrapper)) {
        this._observed.add(wrapper);

        const img = wrapper.querySelector('img');
        if (!img) return;

        if (img.complete && img.naturalWidth > 0) {
          wrapper.classList.add('loaded');
        } else {
          this._observer.observe(wrapper);
        }
      }
    });
  }

  static _loadImage(wrapper, img) {
    const onLoad = () => {
      wrapper.classList.add('loaded');
      wrapper.classList.remove('error');
      cleanup();
    };

    const onError = () => {
      const fallback = img.dataset.fallback;
      if (fallback && img.src !== fallback) {
        img.src = fallback;
        return;
      }
      wrapper.classList.add('error', 'loaded');
      cleanup();
    };

    const cleanup = () => {
      img.removeEventListener('load', onLoad);
      img.removeEventListener('error', onError);
    };

    img.addEventListener('load', onLoad);
    img.addEventListener('error', onError);

    if (img.complete) {
      if (img.naturalWidth > 0) {
        onLoad();
      } else {
        onError();
      }
    }
  }

  static cardThumbnail(src, alt = '', fallback = '/assets/img/logo.webp', extraClass = '', extraStyle = '') {
    return `
      <div class="img-progressive">
        <img src="${src}" 
             class="card-img-top ${extraClass}" 
             alt="${alt}" 
             loading="lazy"
             data-fallback="${fallback}"
             ${extraStyle ? `style="${extraStyle}"` : ''}
             referrerpolicy="no-referrer">
      </div>
    `;
  }

  static heroThumbnail(src, alt = '', fallback = '/assets/img/logo.webp') {
    return `
      <div class="img-progressive post-thumb-wrapper">
        <img src="${src}" 
             class="post-thumbnail" 
             alt="${alt}"
             data-fallback="${fallback}"
             referrerpolicy="no-referrer">
      </div>
    `;
  }

  static inlineThumbnail(src, alt = '', size = '85px', extraClass = '', fallback = '/assets/img/logo.webp') {
    return `
      <div class="img-progressive ${extraClass}" style="width:${size};height:${size};flex-shrink:0;">
        <img src="${src}" 
             alt="${alt}" 
             loading="lazy"
             data-fallback="${fallback}"
             referrerpolicy="no-referrer"
             style="width:100%;height:100%;object-fit:cover;">
      </div>
    `;
  }
}
