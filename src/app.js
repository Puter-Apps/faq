const questionListEl = document.getElementById('question-list');
    const answerContentWrapperEl = document.getElementById('answer-content-wrapper');
    const statusMessagesEl = document.getElementById('status-messages');
    const themeToggleButton = document.getElementById('theme-toggle');
    const themeIcon = themeToggleButton.querySelector('i');
    const scrollToTopButton = document.getElementById('scroll-to-top');
    const searchBar = document.getElementById('search-bar');
    const sidebar = document.getElementById('sidebar');
    const sidebarResizer = document.getElementById('sidebar-resizer');
    const contentArea = document.getElementById('content-area');

    let activeLink = null;
    let currentIframe = null; // Keep track of the current iframe
    let isResizing = false;

    const answersSubFolderName = "answers";
    const MAX_ANSWER_FILES_TO_CHECK = 30;
    const initialPageTitle = "Puter FAQ Center";

    // Function to synchronize iframe theme with the main page
    function syncIframeTheme(iframeInstance) {
        if (iframeInstance && iframeInstance.contentWindow && iframeInstance.contentDocument) {
            try {
                const iframeHtmlElement = iframeInstance.contentDocument.documentElement;
                if (document.body.classList.contains('dark-mode')) {
                    iframeHtmlElement.classList.add('dark-mode');
                } else {
                    iframeHtmlElement.classList.remove('dark-mode');
                }
            } catch (e) {
                // This can happen if the iframe is not fully loaded or if it's a cross-origin iframe (not the case here)
                console.warn("Could not sync theme to iframe. It might be loading or from a different origin (unlikely for local files).", e);
            }
        }
    }

    async function extractQuestionFromHTML(htmlContent) {
        const metaCommentMatch = htmlContent.match(/<!--\s*q:\s*(.+?)\s*-->/i);
        if (metaCommentMatch && metaCommentMatch[1]) {
            return metaCommentMatch[1].trim();
        }
        // Fallback to H1 if meta comment not found
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, "text/html");
            const h1 = doc.querySelector('h1');
            if (h1 && h1.textContent) {
                return h1.textContent.trim();
            }
        } catch (e) {
            console.warn("Could not parse HTML for H1 fallback:", e);
        }
        return null; // Return null if no question found
      }

    async function loadAndDisplayQuestions() {
      statusMessagesEl.textContent = `Scanning for answers in /${answersSubFolderName}/...`;
      questionListEl.innerHTML = '';
      let discoveredAnswers = [];

      for (let i = 1; i <= MAX_ANSWER_FILES_TO_CHECK; i++) {
        const fileName = `${i}.html`;
        const fileURL = `${answersSubFolderName}/${fileName}`;
        try {
          const response = await fetch(fileURL);
          if (response.ok) {
            const rawContent = await response.text();
            const questionText = await extractQuestionFromHTML(rawContent);
            const displayName = questionText || `Answer ${i}`; // Use Answer i if no specific question text
            discoveredAnswers.push({ id: i, fileName, fileURL, displayName });
          } else {
            if (response.status === 404) {
                // console.log(`File ${fileURL} not found, stopping scan.`);
                break; // Stop scanning if a file in the sequence is not found
            }
            console.warn(`Failed to fetch ${fileURL}: ${response.status}`);
          }
        } catch (error) {
            console.error(`Error fetching ${fileURL}:`, error);
            break; // Stop on network or other errors
        }
      }

      if (discoveredAnswers.length === 0) {
        statusMessagesEl.textContent = ''; // Clear "Scanning..." message
        const errorMsg = `No numbered .html answer files found in '/${answersSubFolderName}/'. Make sure files are named 1.html, 2.html, etc.`;
        questionListEl.innerHTML = `<p class="status-message">${errorMsg}</p>`;
        answerContentWrapperEl.innerHTML = `<div class="loading-message">${errorMsg}</div>`;
        document.title = initialPageTitle;
        return;
      }

      statusMessagesEl.textContent = ''; // Clear "Scanning..." message
      discoveredAnswers.forEach(answer => {
        const link = document.createElement('div');
        link.className = 'question-link';
        link.textContent = answer.displayName;
        link.setAttribute('data-fileurl', answer.fileURL);
        link.setAttribute('data-question-text', answer.displayName.toLowerCase());
        link.onclick = () => {
          if (activeLink) activeLink.classList.remove('active');
          link.classList.add('active');
          activeLink = link;
          document.title = `${answer.displayName} | ${initialPageTitle}`;
          answerContentWrapperEl.innerHTML = '<div class="loading-message">Loading answer...</div>';

          if (currentIframe) currentIframe.remove(); // Remove old iframe if exists

          currentIframe = document.createElement('iframe');
          currentIframe.onload = () => { // Sync theme AFTER iframe has loaded
            syncIframeTheme(currentIframe);
          };
          currentIframe.src = answer.fileURL; // Set src to trigger load

          answerContentWrapperEl.innerHTML = ''; // Clear loading message
          answerContentWrapperEl.appendChild(currentIframe);
        };
        questionListEl.appendChild(link);
      });

      if (questionListEl.firstChild) {
        answerContentWrapperEl.innerHTML = `<div class="loading-message">Welcome! Select a question from the left to view its answer.</div>`;
      } else {
         // This case should ideally not be reached if discoveredAnswers.length > 0
        answerContentWrapperEl.innerHTML = '<div class="loading-message">Select a question.</div>';
        document.title = initialPageTitle;
      }
    }

    searchBar.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const links = questionListEl.querySelectorAll('.question-link');
        let visibleCount = 0;
        links.forEach(link => {
            const questionText = link.getAttribute('data-question-text');
            if (questionText.includes(searchTerm)) {
                link.classList.remove('hidden-by-search');
                visibleCount++;
            } else {
                link.classList.add('hidden-by-search');
            }
        });
        const noResultsEl = questionListEl.querySelector('.no-results');
        if (visibleCount === 0 && searchTerm !== '') {
             if (!noResultsEl) {
                const noResultsMsg = document.createElement('p');
                noResultsMsg.className = 'status-message no-results';
                noResultsMsg.textContent = 'No questions match your search.';
                questionListEl.appendChild(noResultsMsg);
             }
        } else {
            if (noResultsEl) noResultsEl.remove();
        }
    });

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        } else {
            document.body.classList.remove('dark-mode');
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        }
        localStorage.setItem('faq_theme', theme);

        // Sync current iframe's theme if it exists
        if (currentIframe) {
            syncIframeTheme(currentIframe);
        }
    }
    themeToggleButton.addEventListener('click', () => {
        applyTheme(document.body.classList.contains('dark-mode') ? 'light' : 'dark');
    });
    const savedTheme = localStorage.getItem('faq_theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme(systemPrefersDark ? 'dark' : 'light');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!localStorage.getItem('faq_theme')) { // Only apply if no explicit user choice
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });

    const scrollableSidebar = document.getElementById('question-list-container');
    scrollableSidebar.addEventListener('scroll', () => {
        scrollToTopButton.classList.toggle('visible', scrollableSidebar.scrollTop > 150);
    });
    scrollToTopButton.addEventListener('click', () => {
        scrollableSidebar.scrollTo({ top: 0, behavior: 'smooth' });
    });

    let initialSidebarWidth = 0;
    let initialMouseX = 0;

    sidebarResizer.addEventListener('mousedown', function(e) {
        e.preventDefault();
        isResizing = true;
        initialMouseX = e.clientX;
        initialSidebarWidth = sidebar.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none'; // Prevent text selection during resize
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const dx = e.clientX - initialMouseX;
        let newWidth = initialSidebarWidth + dx;

        const minWidth = parseInt(getComputedStyle(sidebar).minWidth, 10) || 150; // Fallback minWidth
        const contentAreaMinTheoreticalWidth = parseInt(getComputedStyle(contentArea).minWidth, 10) || 200; // Fallback
        const resizerAndPadding = sidebarResizer.offsetWidth + (parseInt(getComputedStyle(sidebar).paddingLeft, 10) || 0) + (parseInt(getComputedStyle(sidebar).paddingRight, 10) || 0) + (parseInt(getComputedStyle(contentArea).paddingLeft, 10) || 0) + (parseInt(getComputedStyle(contentArea).paddingRight, 10) || 0) ;
        const viewportWidth = window.innerWidth;
        let calculatedMaxWidthForSidebar = viewportWidth - contentAreaMinTheoreticalWidth - resizerAndPadding;

        const cssMaxWidthValue = getComputedStyle(sidebar).maxWidth;
        let cssMaxWidthPixels = viewportWidth; // Default to full viewport if not specified or in percent
        if (cssMaxWidthValue && cssMaxWidthValue !== 'none') {
            if (cssMaxWidthValue.endsWith('px')) {
                cssMaxWidthPixels = parseInt(cssMaxWidthValue, 10);
            } else if (cssMaxWidthValue.endsWith('%')) {
                cssMaxWidthPixels = viewportWidth * (parseFloat(cssMaxWidthValue) / 100);
            }
        }

        const finalMaxWidth = Math.min(calculatedMaxWidthForSidebar, cssMaxWidthPixels);
        newWidth = Math.max(minWidth, Math.min(newWidth, finalMaxWidth));
        sidebar.style.width = `${newWidth}px`;
    }

    function handleMouseUp() {
        if (!isResizing) return;
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto'; // Re-enable text selection
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadAndDisplayQuestions();
    });