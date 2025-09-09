document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTS ---
    const views = {
        aiCoach: document.getElementById('ai-coach-view'),
        liveRun: document.getElementById('live-run-view'),
        history: document.getElementById('history-view'),
    };
    const navLinks = {
        liveRun: document.getElementById('nav-live-run'),
        summary: document.getElementById('nav-summary'),
        history: document.getElementById('nav-history'),
    };
    const closeLiveRunButton = document.getElementById('close-live-run');
    const liveDistanceEl = document.getElementById('live-distance');
    const livePaceEl = document.getElementById('live-pace');
    const liveTimeEl = document.getElementById('live-time');
    const pauseButton = document.getElementById('pause-button');
    const finishButton = document.getElementById('finish-button');
    const gpsStatusTextEl = document.getElementById('gps-status-text');
    const gpsAccuracyTextEl = document.getElementById('gps-accuracy-text');
    const historyListEl = document.getElementById('history-list');
    const geminiKeyInput = document.getElementById('gemini-key');
    const saveKeyButton = document.getElementById('save-key-button');
    const summaryWelcomeEl = document.getElementById('summary-welcome');
    const summaryMainEl = document.getElementById('summary-main');
    const summaryLastDistEl = document.getElementById('summary-last-dist');
    const summaryLastTimeEl = document.getElementById('summary-last-time');
    const summaryBestDistEl = document.getElementById('summary-best-dist');
    const summaryBestTimeEl = document.getElementById('summary-best-time');
    const aiAdviceTitleEl = document.getElementById('ai-advice-title');
    const aiAdviceBodyEl = document.getElementById('ai-advice-body');
    const liveMapCanvas = document.getElementById('live-map');
    const summaryMapCanvas = document.getElementById('summary-map');

    // --- STATE ---
    let runState = {};
    let allRuns = [];
    let geminiKey = '';

    // --- UTILS ---
    const formatTime = (milliseconds) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds}s`;
    };
    const formatDistance = (meters) => `${(meters / 1000).toFixed(2)}km`;

    // --- NAVIGATION ---
    const showView = (viewName) => {
        Object.values(views).forEach(view => view.classList.add('hidden'));
        if (viewName === 'aiCoach') {
            updateSummaryView();
        }
        views[viewName].classList.remove('hidden');
    };

    navLinks.liveRun.addEventListener('click', (e) => { e.preventDefault(); showView('liveRun'); startDemoRun(); });
    navLinks.summary.addEventListener('click', (e) => { e.preventDefault(); showView('aiCoach'); });
    navLinks.history.addEventListener('click', (e) => { e.preventDefault(); renderHistory(); showView('history'); });
    closeLiveRunButton.addEventListener('click', () => {
        if (runState.isRunning) {
            if (confirm('Are you sure you want to discard this run?')) {
                stopRun(false); // Discard without saving
                showView('aiCoach');
            }
        } else {
            showView('aiCoach');
        }
    });

    // --- LIVE RUN ---
    const startDemoRun = () => {
        // --- DEMO MOCK DATA ---
        const route = [
          { latitude: 34.0522, longitude: -118.2437 },
          { latitude: 34.0525, longitude: -118.2445 },
          { latitude: 34.0528, longitude: -118.2453 },
          { latitude: 34.0531, longitude: -118.2461 },
          { latitude: 34.0534, longitude: -118.2469 },
          { latitude: 34.0537, longitude: -118.2477 },
          { latitude: 34.0540, longitude: -118.2485 },
          { latitude: 34.0543, longitude: -118.2493 },
          { latitude: 34.0546, longitude: -118.2501 },
          { latitude: 34.0549, longitude: -118.2509 },
          { latitude: 34.0552, longitude: -118.2517 },
          { latitude: 34.0555, longitude: -118.2525 },
          { latitude: 34.0558, longitude: -118.2533 },
          { latitude: 34.0561, longitude: -118.2541 },
          { latitude: 34.0564, longitude: -118.2549 },
          { latitude: 34.0567, longitude: -118.2557 },
          { latitude: 34.0570, longitude: -118.2565 },
          { latitude: 34.0573, longitude: -118.2573 },
          { latitude: 34.0576, longitude: -118.2581 },
          { latitude: 34.0579, longitude: -118.2589 },
        ];

        // Pace: 9:32/mile is ~5:55/km.
        // 5k at 5:55/km is 29m 35s.
        // Let's start at 1.5km.
        // Time = 1.5km * 5.916 min/km = 8.874 mins = 8m 52.44s
        const initialDistance = 1500; // meters
        const initialTime = 532 * 1000; // 8m 52s in ms
        const pointsToSkip = 6; // Start at 1.5km, which is 30% of 5k. 30% of 20 points is 6.

        runState = {
            isRunning: true,
            isPaused: false,
            startTime: Date.now() - initialTime,
            elapsedTime: initialTime,
            locations: route.slice(0, pointsToSkip),
            distance: initialDistance,
            watchId: null, // This will be our timer
            timerId: null,
            gpsStatus: 'Active'
        };

        updateGpsStatus('Demo Run in Progress', 'Perfect');
        const ctx = liveMapCanvas.getContext('2d');
        ctx.clearRect(0, 0, liveMapCanvas.width, liveMapCanvas.height);
        drawRoute(liveMapCanvas, runState.locations);
        updateUI(runState);

        let currentIndex = pointsToSkip;

        const tick = () => {
            if (currentIndex >= route.length || runState.isPaused) {
                if (currentIndex >= route.length) {
                    stopRun(false); // end demo
                }
                return;
            }

            const newLocation = route[currentIndex];
            const lastLocation = runState.locations[runState.locations.length - 1];
            const distanceDelta = calculateDistance(lastLocation, newLocation);

            runState.distance += distanceDelta;
            runState.locations.push(newLocation);

            // Update time based on distance and pace
            // Pace = 5.916 min/km = 0.005916 min/m = 0.355 s/m
            runState.elapsedTime += distanceDelta * 0.355 * 1000;
            runState.startTime = Date.now() - runState.elapsedTime;

            drawRoute(liveMapCanvas, runState.locations);
            updateUI(runState);

            currentIndex++;
        };

        runState.watchId = setInterval(tick, 2500); // Add a point every 2.5 seconds
        runState.timerId = setInterval(updateTimer, 1000);
    };

    const startRun = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        runState = { isRunning: true, isPaused: false, startTime: Date.now(), elapsedTime: 0, locations: [], distance: 0, watchId: null, timerId: null, gpsStatus: 'Initializing...' };
        updateGpsStatus('Initializing...', '');

        // Clear the canvas
        const ctx = liveMapCanvas.getContext('2d');
        ctx.clearRect(0, 0, liveMapCanvas.width, liveMapCanvas.height);

        runState.watchId = navigator.geolocation.watchPosition(handleLocationUpdate, handleError, { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
        runState.timerId = setInterval(updateTimer, 1000);
        updateUI(runState);
    };

    const stopRun = (shouldSave) => {
        if (runState.watchId) navigator.geolocation.clearWatch(runState.watchId);
        if (runState.timerId) clearInterval(runState.timerId);
        runState.isRunning = false;
        if (shouldSave && runState.distance > 10) { // Only save runs longer than 10m
            saveRun();
        }
    };

    const togglePause = () => {
        runState.isPaused = !runState.isPaused;
        if (runState.isPaused) {
            clearInterval(runState.timerId);
        } else {
            runState.startTime = Date.now() - runState.elapsedTime;
            runState.timerId = setInterval(updateTimer, 1000);
        }
        updateUI(runState);
    };

    const updateTimer = () => { if (!runState.isPaused) { runState.elapsedTime = Date.now() - runState.startTime; updateUI(runState); } };

    const updateGpsStatus = (status, accuracy) => {
        gpsStatusTextEl.textContent = status;
        if (accuracy) {
            gpsAccuracyTextEl.textContent = `Accuracy: ${accuracy.toFixed(1)}m`;
        } else {
            gpsAccuracyTextEl.textContent = '';
        }
    };

    const handleLocationUpdate = (position) => {
        if (runState.isPaused) return;

        const { latitude, longitude, timestamp, accuracy } = position.coords;

        updateGpsStatus('Active', accuracy);

        // We filter out readings that are too inaccurate
        if (accuracy > 30) {
            console.log(`Skipping location update due to low accuracy: ${accuracy}m`);
            updateGpsStatus('Poor signal. Accuracy too low.', accuracy);
            return;
        }

        const newLocation = { latitude, longitude, timestamp };

        if (runState.locations.length > 0) {
            const lastLocation = runState.locations[runState.locations.length - 1];
            const distanceDelta = calculateDistance(lastLocation, newLocation);
            runState.distance += distanceDelta;
        }

        runState.locations.push(newLocation);
        drawRoute(liveMapCanvas, runState.locations);
        updateUI(runState);
    };
    const handleError = (error) => {
        console.error("Geolocation error: ", error);
        let message = "Could not get location. Please ensure location services are enabled and permissions are granted.";
        let status = "Error";
        switch (error.code) {
            case error.PERMISSION_DENIED:
                status = "Permission Denied";
                message = "Location permission denied. To fix this, go to your browser's settings, find this site, and allow location access.";
                break;
            case error.POSITION_UNAVAILABLE:
                status = "Location Unavailable";
                message = "Location information is unavailable. This might be due to a weak GPS signal. Try moving to an open area.";
                break;
            case error.TIMEOUT:
                status = "Request Timed Out";
                message = "The request to get user location timed out. Please try again with a stronger signal.";
                break;
        }
        updateGpsStatus(status, null);
        alert(message);
        stopRun(false);
        showView('aiCoach');
    };
    const updateUI = (state) => {
        if (!state.isRunning) return;
        const totalSeconds = Math.floor(state.elapsedTime / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        liveTimeEl.textContent = `${minutes}:${seconds}`;
        liveDistanceEl.innerHTML = `${(state.distance / 1000).toFixed(2)}<span class="text-5xl ml-1">km</span>`;
        if (state.distance > 0) {
            const pace = (state.elapsedTime / 1000 / 60) / (state.distance / 1000);
            livePaceEl.innerHTML = `${Math.floor(pace)}:${Math.round((pace % 1) * 60).toString().padStart(2, '0')} <span class="text-lg font-medium text-gray-600">/km</span>`;
        } else {
            livePaceEl.innerHTML = `0:00 <span class="text-lg font-medium text-gray-600">/km</span>`;
        }
        const [pauseIcon, pauseText] = [pauseButton.children[0], pauseButton.children[1]];
        pauseIcon.textContent = state.isPaused ? 'play_arrow' : 'pause';
        pauseText.textContent = state.isPaused ? 'Resume' : 'Pause';
    };
    const calculateDistance = (loc1, loc2) => {
        const R = 6371e3;
        const φ1 = loc1.latitude * Math.PI / 180, φ2 = loc2.latitude * Math.PI / 180;
        const Δφ = (loc2.latitude - loc1.latitude) * Math.PI / 180;
        const Δλ = (loc2.longitude - loc1.longitude) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    // --- DATA & HISTORY ---
    const saveRun = () => {
        try {
            const runData = { date: new Date().toISOString(), distance: runState.distance, duration: runState.elapsedTime, locations: runState.locations };
            allRuns.push(runData);
            localStorage.setItem('runs', JSON.stringify(allRuns));
        } catch (e) {
            console.error("Failed to save run:", e);
            alert("Could not save your run. Local storage might be full or disabled.");
        }
    };
    const loadRuns = () => {
        try {
            const runsJSON = localStorage.getItem('runs');
            if (runsJSON) {
                allRuns = JSON.parse(runsJSON);
            }
        } catch (e) {
            console.error("Failed to load runs:", e);
            allRuns = [];
            alert("Could not load your run history. Local storage might be disabled.");
        }
    };
    const renderHistory = () => {
        historyListEl.innerHTML = '';
        if (allRuns.length === 0) { historyListEl.innerHTML = `<p class="text-center text-gray-500">No runs recorded yet.</p>`; return; }
        allRuns.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach((run, index) => {
            const div = document.createElement('div');
            div.className = 'bg-white rounded-xl shadow-sm p-4';
            div.innerHTML = `<div class="flex justify-between items-center"><div><p class="text-gray-900 font-semibold">${new Date(run.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p><p class="text-gray-600 text-sm">${formatDistance(run.distance)} in ${formatTime(run.duration)}</p></div><canvas id="history-canvas-${index}" class="w-24 h-16 bg-gray-100 rounded-lg"></canvas></div>`;
            historyListEl.appendChild(div);
            drawRoute(document.getElementById(`history-canvas-${index}`), run.locations);
        });
    };
    const drawRoute = (canvas, locations) => {
        if (!canvas || locations.length < 2) return;
        const ctx = canvas.getContext('2d'), { width, height } = canvas;
        if (width === 0 || height === 0) return; // Prevent drawing on a hidden or zero-sized canvas

        const lats = locations.map(l => l.latitude), lons = locations.map(l => l.longitude);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
        const latRange = maxLat - minLat, lonRange = maxLon - minLon;

        if (latRange === 0 || lonRange === 0) return; // Avoid division by zero

        const scale = Math.min(width / lonRange, height / latRange) * 0.9;
        const xOffset = (width - lonRange * scale) / 2, yOffset = (height - latRange * scale) / 2;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'var(--primary-color)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        locations.forEach((loc, index) => {
            const x = (loc.longitude - minLon) * scale + xOffset;
            const y = (maxLat - loc.latitude) * scale + yOffset;
            index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
    };

    // --- AI COACH & SUMMARY ---
    const updateSummaryView = () => {
        if (allRuns.length === 0) {
            summaryWelcomeEl.classList.remove('hidden');
            summaryMainEl.classList.add('hidden');
        } else {
            summaryWelcomeEl.classList.add('hidden');
            summaryMainEl.classList.remove('hidden');

            const lastRun = allRuns[allRuns.length - 1];
            const bestRun = allRuns.reduce((best, current) => (current.distance > best.distance) ? current : best, allRuns[0]);

            summaryLastDistEl.innerHTML = `${formatDistance(lastRun.distance)}<span class="text-sm font-medium">km</span>`;
            summaryLastTimeEl.textContent = formatTime(lastRun.duration);
            summaryBestDistEl.innerHTML = `${formatDistance(bestRun.distance)}<span class="text-sm font-medium">km</span>`;
            summaryBestTimeEl.textContent = formatTime(bestRun.duration);

            drawRoute(summaryMapCanvas, lastRun.locations);

            // Placeholder for AI advice
            getAIAdvice(lastRun);
        }
    };

    const getAIAdvice = async (run) => {
        aiAdviceTitleEl.textContent = "Analyzing your run...";
        aiAdviceBodyEl.textContent = "Please wait while we generate your personalized advice.";

        if (!geminiKey) {
            aiAdviceTitleEl.textContent = "Set your API Key";
            aiAdviceBodyEl.textContent = "Please add your Google Gemini API key in the settings below to get personalized advice.";
            return;
        }

        // This is where the Gemini API call would go.
        // For now, we'll just use a placeholder.
        setTimeout(() => {
            aiAdviceTitleEl.textContent = "Great job on your last run!";
            aiAdviceBodyEl.textContent = "This is placeholder advice. In a real app, we would call the Gemini API to get personalized feedback based on your run data.";
        }, 1000);
    };

    const saveApiKey = () => {
        geminiKey = geminiKeyInput.value;
        if (geminiKey) {
            try {
                localStorage.setItem('geminiApiKey', geminiKey);
                alert('API Key saved!');
            } catch (e) {
                console.error("Failed to save API key:", e);
                alert("Could not save API key. Local storage might be full or disabled.");
            }
        }
    };
    const loadApiKey = () => {
        try {
            const savedKey = localStorage.getItem('geminiApiKey');
            if (savedKey) {
                geminiKey = savedKey;
                geminiKeyInput.value = savedKey;
            }
        } catch (e) {
            console.error("Failed to load API key:", e);
            alert("Could not load API key. Local storage might be disabled.");
        }
    };

    // --- INITIALIZATION ---
    pauseButton.addEventListener('click', togglePause);
    finishButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to finish this run?')) {
            stopRun(true); // Save the run
            showView('aiCoach');
        }
    });
    saveKeyButton.addEventListener('click', saveApiKey);

    loadRuns();
    loadApiKey();
    showView('aiCoach');
});
