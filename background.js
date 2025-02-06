// Helper functions to use promises with chrome.storage
const storage = {
  get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
  set: (data) => new Promise((resolve) => chrome.storage.local.set(data, resolve))
};

// Initialize alarms for all scheduled videos when extension loads
async function initializeAlarms() {
  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const now = Date.now();

    // Clear all existing alarms
    await chrome.alarms.clearAll();

    // Create new alarms for future scheduled videos
    for (const video of scheduledVideos) {
      if (video.status !== 'scheduled') continue;
      
      const timeUntilAlarm = video.scheduleTime - now;
      if (timeUntilAlarm > 0) {
        const delayInMinutes = Math.max(1, timeUntilAlarm / 60000);
        chrome.alarms.create(video.id, { delayInMinutes });
      } else {
        // If the schedule time has passed, mark it as expired
        video.status = 'expired';
      }
    }

    // Save any updates to storage
    await storage.set({ scheduledVideos });
  } catch (error) {
    console.error('Error initializing alarms:', error);
  }
}

// Listen for alarms and open the video when triggered
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const scheduledItem = scheduledVideos.find(item => item.id === alarm.name);

    if (scheduledItem && scheduledItem.status === 'scheduled') {
      // Open the video in a new tab
      chrome.tabs.create({ url: scheduledItem.videoUrl }, (tab) => {
        console.log(`Opened scheduled video in tab ${tab.id}`);
      });

      // Update the video status to completed
      const updatedVideos = scheduledVideos.map(item =>
        item.id === alarm.name ? { ...item, status: 'completed' } : item
      );
      await storage.set({ scheduledVideos: updatedVideos });
    }
  } catch (error) {
    console.error('Error handling alarm:', error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scheduleVideo') {
    // Create a new tab with the popup and pass the video URL
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html') + '?videoUrl=' + encodeURIComponent(request.videoUrl)
    });
  }
});

// Initialize alarms when extension loads
initializeAlarms();
