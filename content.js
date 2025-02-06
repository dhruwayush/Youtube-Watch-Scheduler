// Function to create and inject the Schedule button
function createScheduleButton() {
    // Check if we're on a video page
    if (!window.location.pathname.startsWith('/watch')) return;

    // Create the button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'schedule-button-container';
    buttonContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        margin-left: 8px;
    `;

    // Create the button
    const scheduleButton = document.createElement('button');
    scheduleButton.className = 'yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m schedule-video-button';
    scheduleButton.innerHTML = `
        <div class="cbox yt-spec-button-shape-next--button-text-content">
            <div class="yt-spec-button-shape-next--button-text-content">
                <span class="yt-core-attributed-string yt-core-attributed-string--white-space-no-wrap">
                    <svg viewBox="0 0 24 24" style="width: 20px; height: 20px; margin-right: 6px; vertical-align: middle;">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" fill="currentColor"/>
                        <path d="M12.5 7H11v6l5.2 3.2.8-1.3-4.5-2.7V7z" fill="currentColor"/>
                    </svg>
                    Schedule
                </span>
            </div>
        </div>
    `;

    // Add hover effect using YouTube's classes
    scheduleButton.addEventListener('mouseover', () => {
        scheduleButton.classList.add('yt-spec-button-shape-next--hover');
    });
    scheduleButton.addEventListener('mouseout', () => {
        scheduleButton.classList.remove('yt-spec-button-shape-next--hover');
    });

    // Add click handler
    scheduleButton.addEventListener('click', () => {
        const videoUrl = window.location.href;
        // Send message to background script to open popup with video URL
        chrome.runtime.sendMessage({ 
            action: 'scheduleVideo', 
            videoUrl: videoUrl 
        });
    });

    // Add the button to the container
    buttonContainer.appendChild(scheduleButton);

    function tryInjectButton() {
        // Check multiple possible selectors for the menu container
        const menuSelectors = [
            '#actions-inner',
            '#top-level-buttons-computed',
            'ytd-menu-renderer.ytd-video-primary-info-renderer',
            '#actions'
        ];

        for (const selector of menuSelectors) {
            const menuContainer = document.querySelector(selector);
            if (menuContainer && !document.querySelector('.schedule-button-container')) {
                // Try different positions for insertion
                const possibleTargets = [
                    'ytd-segmented-like-dislike-button-renderer + ytd-button-renderer',
                    'ytd-button-renderer:nth-child(1)',
                    '.ytd-menu-renderer.style-scope:first-child'
                ];

                for (const targetSelector of possibleTargets) {
                    const target = menuContainer.querySelector(targetSelector);
                    if (target) {
                        try {
                            menuContainer.insertBefore(buttonContainer, target.nextSibling);
                            return true;
                        } catch (e) {
                            console.log('Failed to insert at', targetSelector, e);
                            continue;
                        }
                    }
                }

                // If no specific target found, try appending to the menu
                try {
                    menuContainer.appendChild(buttonContainer);
                    return true;
                } catch (e) {
                    console.log('Failed to append to', selector, e);
                }
            }
        }
        return false;
    }

    // Try to inject immediately
    if (!tryInjectButton()) {
        // If failed, observe DOM changes
        const observer = new MutationObserver(() => {
            if (tryInjectButton() || document.querySelector('.schedule-button-container')) {
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Disconnect after 10 seconds to prevent infinite observation
        setTimeout(() => observer.disconnect(), 10000);
    }
}

// Initial injection
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createScheduleButton);
} else {
    createScheduleButton();
}

// Handle navigation in YouTube's SPA
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        createScheduleButton();
    }
}).observe(document, { subtree: true, childList: true });
