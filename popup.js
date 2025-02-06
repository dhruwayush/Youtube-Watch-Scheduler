let currentEditVideoUrl = null;
let currentEditId = null;

// Helper functions to use promises with chrome.storage
const storage = {
  get: (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve)),
  set: (data) => new Promise((resolve) => chrome.storage.local.set(data, resolve)),
};

// Helper function to generate unique ID
function generateId() {
  return `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function to extract video ID from YouTube URL
function extractVideoId(url) {
  const urlObj = new URL(url);
  if (urlObj.hostname === 'youtu.be') {
    return urlObj.pathname.slice(1);
  }
  return urlObj.searchParams.get('v');
}

// Helper function to validate YouTube URL
function isValidYouTubeUrl(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.length > 1;
    }
    if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
      return urlObj.searchParams.get('v') !== null;
    }
    return false;
  } catch {
    return false;
  }
}

// Schedule new video
document.getElementById('scheduleButton').addEventListener('click', async () => {
  const videoUrl = document.getElementById('videoUrl').value.trim();
  const scheduleInput = document.getElementById('scheduleTime').value;

  if (!videoUrl || !scheduleInput) {
    alert('Please enter both a YouTube URL and schedule time.');
    return;
  }

  if (!isValidYouTubeUrl(videoUrl)) {
    alert('Please enter a valid YouTube URL.');
    return;
  }

  const scheduleTime = new Date(scheduleInput).getTime();
  if (isNaN(scheduleTime) || scheduleTime <= Date.now()) {
    alert('Please select a future date/time.');
    return;
  }

  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const id = generateId();
    const newSchedule = {
      id,
      videoUrl,
      scheduleTime,
      status: 'scheduled',
      videoId: extractVideoId(videoUrl),
      createdAt: Date.now()
    };

    scheduledVideos.push(newSchedule);
    await storage.set({ scheduledVideos });

    const delayInMinutes = Math.max(1, (scheduleTime - Date.now()) / 60000);
    chrome.alarms.create(id, { delayInMinutes });
    
    document.getElementById('videoUrl').value = '';
    document.getElementById('scheduleTime').value = '';
    alert('Video scheduled successfully!');
    renderScheduledList();
  } catch (error) {
    console.error('Error scheduling video:', error);
    alert('An error occurred while scheduling the video. Please try again.');
  }
});

// Render scheduled videos list
async function renderScheduledList() {
  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const list = document.getElementById('scheduledList');
    list.innerHTML = '';

    if (scheduledVideos.length === 0) {
      list.innerHTML = '<li class="scheduled-item">No videos scheduled.</li>';
      return;
    }

    // Sort by schedule time
    const sortedVideos = [...scheduledVideos]
      .filter(item => item.status === 'scheduled')
      .sort((a, b) => a.scheduleTime - b.scheduleTime);

    sortedVideos.forEach(item => {
      const li = document.createElement('li');
      li.className = 'scheduled-item';
      const date = new Date(item.scheduleTime);
      
      li.innerHTML = `
        <div class="video-title">${item.videoUrl}</div>
        <div class="schedule-time">Scheduled for: ${date.toLocaleString()}</div>
        <div class="actions">
          <button class="open" data-id="${item.id}">Open Video</button>
          <button class="edit" data-id="${item.id}">Edit</button>
          <button class="cancel" data-id="${item.id}">Cancel</button>
          <button class="complete" data-id="${item.id}">Mark Complete</button>
        </div>
      `;
      list.appendChild(li);
    });

    // Add event listeners
    document.querySelectorAll('.open').forEach(btn => {
      btn.addEventListener('click', (e) => openVideo(e.target.dataset.id));
    });
    document.querySelectorAll('.cancel').forEach(btn => {
      btn.addEventListener('click', (e) => cancelScheduledVideo(e.target.dataset.id));
    });
    document.querySelectorAll('.edit').forEach(btn => {
      btn.addEventListener('click', (e) => openEditForm(e.target.dataset.id));
    });
    document.querySelectorAll('.complete').forEach(btn => {
      btn.addEventListener('click', (e) => markAsComplete(e.target.dataset.id));
    });
  } catch (error) {
    console.error('Error rendering list:', error);
    alert('An error occurred while loading the scheduled videos.');
  }
}

// Cancel scheduled video
async function cancelScheduledVideo(id) {
  if (!confirm('Are you sure you want to cancel this scheduled video?')) {
    return;
  }

  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const updatedVideos = scheduledVideos.map(item => 
      item.id === id ? { ...item, status: 'cancelled' } : item
    );
    
    await storage.set({ scheduledVideos: updatedVideos });
    await chrome.alarms.clear(id);
    renderScheduledList();
  } catch (error) {
    console.error('Error cancelling video:', error);
    alert('An error occurred while cancelling the video.');
  }
}

// Mark video as complete
async function markAsComplete(id) {
  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const updatedVideos = scheduledVideos.map(item => 
      item.id === id ? { ...item, status: 'completed' } : item
    );
    
    await storage.set({ scheduledVideos: updatedVideos });
    await chrome.alarms.clear(id);
    renderScheduledList();
  } catch (error) {
    console.error('Error marking video as complete:', error);
    alert('An error occurred while marking the video as complete.');
  }
}

// Open edit form
async function openEditForm(id) {
  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const videoItem = scheduledVideos.find(item => item.id === id);
    
    if (videoItem) {
      currentEditVideoUrl = videoItem.videoUrl;
      currentEditId = id;
      const date = new Date(videoItem.scheduleTime);
      const formattedDate = date.toISOString().slice(0, 16);
      document.getElementById('editScheduleTime').value = formattedDate;
      document.getElementById('editForm').style.display = 'block';
    }
  } catch (error) {
    console.error('Error opening edit form:', error);
    alert('An error occurred while opening the edit form.');
  }
}

// Save edited schedule
document.getElementById('saveEditButton').addEventListener('click', async () => {
  const newTimeInput = document.getElementById('editScheduleTime').value;
  if (!newTimeInput) {
    alert('Please select a new time.');
    return;
  }

  const newScheduleTime = new Date(newTimeInput).getTime();
  if (isNaN(newScheduleTime) || newScheduleTime <= Date.now()) {
    alert('Please select a valid future date/time.');
    return;
  }

  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const updatedVideos = scheduledVideos.map(item => {
      if (item.id === currentEditId) {
        return { ...item, scheduleTime: newScheduleTime };
      }
      return item;
    });

    await storage.set({ scheduledVideos: updatedVideos });
    await chrome.alarms.clear(currentEditId);
    
    const delayInMinutes = Math.max(1, (newScheduleTime - Date.now()) / 60000);
    chrome.alarms.create(currentEditId, { delayInMinutes });
    
    closeEditForm();
    renderScheduledList();
  } catch (error) {
    console.error('Error saving schedule:', error);
    alert('An error occurred while saving the schedule.');
  }
});

// Cancel editing
document.getElementById('cancelEditButton').addEventListener('click', closeEditForm);

function closeEditForm() {
  currentEditVideoUrl = null;
  currentEditId = null;
  document.getElementById('editForm').style.display = 'none';
}

// Open video immediately
async function openVideo(id) {
  try {
    const { scheduledVideos = [] } = await storage.get({ scheduledVideos: [] });
    const video = scheduledVideos.find(item => item.id === id);
    
    if (video) {
      chrome.tabs.create({ url: video.videoUrl }, (tab) => {
        console.log(`Opened video in tab ${tab.id}`);
      });
    }
  } catch (error) {
    console.error('Error opening video:', error);
    alert('An error occurred while opening the video.');
  }
}

// Initialize Flatpickr
function initializeDatePickers() {
  // Configure main schedule time picker
  flatpickr("#scheduleTime", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    defaultHour: new Date().getHours() + 1,
    theme: "material_red",
    time_24hr: false,
    minuteIncrement: 5,
    onChange: function(selectedDates, dateStr) {
      // Validate that the selected date is in the future
      if (selectedDates[0] <= new Date()) {
        alert('Please select a future date and time');
        this.clear();
      }
    }
  });

  // Configure edit schedule time picker
  flatpickr("#editScheduleTime", {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    minDate: "today",
    theme: "material_red",
    time_24hr: false,
    minuteIncrement: 5,
    onChange: function(selectedDates, dateStr) {
      if (selectedDates[0] <= new Date()) {
        alert('Please select a future date and time');
        this.clear();
      }
    }
  });
}

// Handle quick time buttons
function initializeQuickTimeButtons() {
  document.querySelectorAll('.quick-time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const hours = parseInt(btn.dataset.time);
      const date = new Date();
      date.setHours(date.getHours() + hours);
      
      // Update the flatpickr instance
      const fp = document.querySelector("#scheduleTime")._flatpickr;
      fp.setDate(date);
    });
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', () => {
  // Initialize date pickers
  initializeDatePickers();
  
  // Initialize quick time buttons
  initializeQuickTimeButtons();
  
  // Check for video URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const videoUrl = urlParams.get('videoUrl');
  
  if (videoUrl) {
    document.getElementById('videoUrl').value = videoUrl;
    // Set default schedule time to 1 hour from now
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    const fp = document.querySelector("#scheduleTime")._flatpickr;
    fp.setDate(defaultTime);
  }
  
  renderScheduledList();
});
