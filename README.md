# FanBlog: Modern User Generated Content Blogging Platform

FanBlog is a high performance blogging application designed for user generated content. The platform has been migrated to Astro Server Side Rendering to deliver fast page load speeds, superior search engine optimization, and serverless scalability. It utilizes Google Sheets as a primary database and Google Apps Script as a secure REST API middleware.

## Core Features

### Server Side Rendering Architecture
All article pages are rendered dynamically on the server using the Vercel serverless environment. This approach ensures immediate content delivery and optimal compatibility with search engine crawlers.

### Clean Dynamic Routing
Legacy query parameter URLs have been replaced with elegant, search engine friendly dynamic paths under the `/post/[slug]` route structure. This improves readability and indexation quality.

### Automatic 301 Redirection
A robust server side redirect mechanism automatically routes legacy query parameter requests to their modern dynamic counterparts, preserving historical search ranking equity and preventing broken link errors.

### Advanced Search Engine Optimization and Open Graph Previews
* **Dynamic Tag Generation:** The application dynamically analyzes article titles to filter out stop words and generate relevant metadata keywords and tags.
* **Rich Social Sharing Previews:** Comprehensive Open Graph parameters and Twitter Card properties are fully integrated, using WebP image formatting and optimized dimensions for high resolution previews across digital communication platforms.
* **Structured JSON-LD Data:** Full Schema.org integration using the BlogPosting schema publishes key technical data including word counts and reading duration to qualify for Google Rich Snippets.

### Independent Author Ecosystem
* **Secure Authentication:** User signup and session based login systems allow members to securely access their accounts.
* **Author Dashboard:** An interactive workspace allows writers to create, edit, and delete their blog posts independently.
* **Custom Profile Management:** Authors manage their public bio descriptions and personalized avatar URLs, which fallback to dynamic placeholder services when empty.

### Content Discovery and Classification
* **Dynamic Search and Explore:** Readers can browse the latest and most popular community content using the interactive search utility.
* **Dynamic Taxonomy:** Post categories are categorized cleanly to enable quick navigation through specific reading niches.

### Administrative Control Panel
* **Content Moderation:** Administrators possess dedicated dashboard facilities to manage the entire user base and monitor posted articles to maintain platform standards.
* **Security Isolation:** Administrative UI components are hidden from the DOM by default until explicit client-side session validation is successfully completed.

## Technical Architecture

* **Framework:** Astro
* **Deployment Adapter:** @astrojs/vercel (Serverless mode)
* **User Interface:** CSS, Bootstrap, Animate.css, AOS (Animate On Scroll)
* **Database:** Google Sheets
* **API Middleware:** Google Apps Script

## Local Development Instructions

### Prerequisites
* Node.js version 22.12.0 or newer is required.

### Set Up and Installation

1. Install project dependencies:
   ```bash
   npm install
   ```

2. Run the local development server:
   ```bash
   npm run dev
   ```
   The local application will be accessible at `http://localhost:4321`.

3. Compile the production build:
   ```bash
   npm run build
   ```

## Security and Optimization Standards
* **Cross Site Scripting Mitigation:** Strict HTML input sanitization is executed via specialized DOMParser modules in the API handler to neutralize script injection risks.
* **API Caching Layer:** Sessional cache mechanisms store retrieve requests for a duration of five minutes, mitigating Google API read quota limitations and improving load times.
* **Automated Asset Resolution:** Fallback strategies for images and icons prevent 404 errors during dynamic asset retrieval.
