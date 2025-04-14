// Global variables
let hospitalMap;
let accidentMarker;
let hospitalMarker;
let routeLine;
let alertHistory = [];
let currentStatus = "normal"; // normal, warning, danger
let alertSound = document.getElementById("alert-sound");
let ambulanceData = [
    { id: "AMB-001", status: "Available", location: "Hospital", eta: "-" },
    { id: "AMB-002", status: "Available", location: "Hospital", eta: "-" },
    { id: "AMB-003", status: "Available", location: "Hospital", eta: "-" },
    { id: "AMB-004", status: "Dispatched", location: "Downtown", eta: "5 min" }
];

// Initialize when the document is loaded
document.addEventListener("DOMContentLoaded", function() {
    // Update the current time
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Initialize the map
    initHospitalMap();
    
    // Initialize ambulance table
    updateAmbulanceTable();
    
    // Start polling for accident status
    checkAccidentStatus();
    setInterval(checkAccidentStatus, 3000);
    
    // Add event listeners for buttons
    document.getElementById("dispatch-ambulance").addEventListener("click", dispatchAmbulance);
    document.getElementById("acknowledge-alert").addEventListener("click", acknowledgeAlert);
});

// Function to update the current time display
function updateCurrentTime() {
    const now = new Date();
    document.getElementById("current-time").textContent = now.toLocaleTimeString();
}

// Initialize the hospital map
function initHospitalMap() {
    // Hospital location
    const hospitalLocation = [40.7168, -73.9861]; // Example hospital location
    
    hospitalMap = L.map('hospital-map').setView(hospitalLocation, 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(hospitalMap);
    
    // Add hospital marker
    const hospitalIcon = L.divIcon({
        className: 'hospital-marker',
        html: '<div style="background-color: #4caf50; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });
    
    hospitalMarker = L.marker(hospitalLocation, {icon: hospitalIcon}).addTo(hospitalMap);
    hospitalMarker.bindPopup("<b>City Hospital</b>").openPopup();
}

// Function to check the accident status
function checkAccidentStatus() {
    fetch('/accident_status')
        .then(response => response.json())
        .then(data => {
            updateHospitalDashboard(data);
        })
        .catch(error => {
            console.error('Error fetching accident status:', error);
        });
}

// Function to update the hospital dashboard with accident data
function updateHospitalDashboard(data) {
    const statusLight = document.getElementById("status-light");
    const statusText = document.getElementById("status-text");
    const accidentInfo = document.getElementById("accident-info");
    const accidentImageContainer = document.getElementById("accident-image-container");
    
    if (data.detected) {
        // Update status indicator
        statusLight.className = "status-light danger";
        statusText.textContent = "⚠️ ACCIDENT ALERT";
        
        // Show accident info
        accidentInfo.classList.remove("hidden");
        
        // Update accident details
        document.getElementById("accident-time").textContent = `Time: ${data.time}`;
        document.getElementById("accident-location").textContent = `Location: ${data.location}`;
        document.getElementById("accident-details").textContent = `Details: ${data.details}`;
        
        // Calculate estimated arrival time
        const estimatedTime = calculateEstimatedArrivalTime();
        document.getElementById("estimated-arrival-time").textContent = `Estimated arrival time: ${estimatedTime}`;
        
        // Update accident image if available
        if (data.image) {
            document.getElementById("accident-image").src = data.image;
            accidentImageContainer.classList.remove("hidden");
        }
        
        // Update map with accident location and route
        updateAccidentLocationOnMap(data.location);
        
        // Play alert sound if status just changed to danger
        if (currentStatus !== "danger") {
            playAlertSound();
            addAlertToHistory(data);
        }
        
        currentStatus = "danger";
    } else {
        // Reset to normal status
        statusLight.className = "status-light";
        statusText.textContent = "Monitoring...";
        accidentInfo.classList.add("hidden");
        accidentImageContainer.classList.add("hidden");
        
        currentStatus = "normal";
    }
}

// Function to update the map with the accident location and route
function updateAccidentLocationOnMap(locationStr) {
    // In a real application, you would geocode the location string
    // For this demo, we'll use random coordinates near a default location
    const hospitalLocation = hospitalMarker.getLatLng();
    const accidentLat = hospitalLocation.lat + (Math.random() - 0.5) * 0.05;
    const accidentLng = hospitalLocation.lng + (Math.random() - 0.5) * 0.05;
    const accidentLocation = [accidentLat, accidentLng];
    
    // Create or update the accident marker
    if (accidentMarker) {
        accidentMarker.setLatLng(accidentLocation);
    } else {
        const accidentIcon = L.divIcon({
            className: 'accident-marker',
            html: '<div style="background-color: #f44336; width: 15px; height: 15px; border-radius: 50%; border: 2px solid white;"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        accidentMarker = L.marker(accidentLocation, {icon: accidentIcon}).addTo(hospitalMap);
    }
    
    accidentMarker.bindPopup(`<b>Accident Location</b><br>${locationStr}`).openPopup();
    
    // Create or update the route line
    const routeCoordinates = [
        hospitalLocation,
        [hospitalLocation.lat + (accidentLat - hospitalLocation.lat) * 0.3, hospitalLocation.lng + (accidentLng - hospitalLocation.lng) * 0.3],
        [hospitalLocation.lat + (accidentLat - hospitalLocation.lat) * 0.6, hospitalLocation.lng + (accidentLng - hospitalLocation.lng) * 0.6],
        accidentLocation
    ];
    
    if (routeLine) {
        hospitalMap.removeLayer(routeLine);
    }
    
    routeLine = L.polyline(routeCoordinates, {color: '#3388ff', weight: 4, opacity: 0.7}).addTo(hospitalMap);
    
    // Adjust map view to show both points
    const bounds = L.latLngBounds([hospitalLocation, accidentLocation]);
    hospitalMap.fitBounds(bounds, {padding: [50, 50]});
    
    // Calculate and display distance and ETA
    const distance = calculateDistance(hospitalLocation, {lat: accidentLat, lng: accidentLng});
    document.getElementById("distance-to-accident").textContent = `${distance.toFixed(2)} km`;
    
    const eta = calculateETA(distance);
    document.getElementById("eta").textContent = eta;
}

// Function to calculate distance between two points (in km)
function calculateDistance(point1, point2) {
    // Simple distance calculation (not accurate for large distances)
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to calculate ETA based on distance
function calculateETA(distance) {
    // Assume average speed of 60 km/h for ambulance
    const speedKmPerHour = 60;
    const timeHours = distance / speedKmPerHour;
    const timeMinutes = Math.round(timeHours * 60);
    
    if (timeMinutes < 1) {
        return "Less than 1 minute";
    } else {
        return `Approximately ${timeMinutes} minutes`;
    }
}

// Function to calculate estimated arrival time
function calculateEstimatedArrivalTime() {
    const now = new Date();
    const distanceElement = document.getElementById("distance-to-accident");
    let distance = 5; // Default distance in km
    
    if (distanceElement && distanceElement.textContent) {
        const distanceText = distanceElement.textContent;
        const distanceMatch = distanceText.match(/(\d+\.?\d*)/);
        if (distanceMatch) {
            distance = parseFloat(distanceMatch[1]);
        }
    }
    
    // Assume average speed of 60 km/h for ambulance
    const speedKmPerHour = 60;
    const timeHours = distance / speedKmPerHour;
    const timeMinutes = Math.round(timeHours * 60);
    
    // Add timeMinutes to current time
    now.setMinutes(now.getMinutes() + timeMinutes);
    
    return now.toLocaleTimeString();
}

// Function to play the alert sound
function playAlertSound() {
    if (alertSound) {
        alertSound.currentTime = 0;
        alertSound.play().catch(e => {
            console.log("Error playing sound:", e);
        });
    }
}

// Function to add an alert to the history
function addAlertToHistory(data) {
    const now = new Date();
    
    // Create a new alert object
    const newAlert = {
        id: Date.now(),
        time: data.time || now.toLocaleTimeString(),
        location: data.location,
        status: "Active",
        response: "Pending"
    };
    
    // Add to the alert history array
    alertHistory.unshift(newAlert);
    
    // Limit the history to 10 items
    if (alertHistory.length > 10) {
        alertHistory.pop();
    }
    
    // Update the history table
    updateAlertHistoryTable();
}

// Function to update the alert history table
function updateAlertHistoryTable() {
    const historyBody = document.getElementById("history-body");
    
    // Clear the existing rows
    historyBody.innerHTML = "";
    
    // Add the alerts to the table
    alertHistory.forEach(alert => {
        const row = document.createElement("tr");
        
        // Time column
        const timeCell = document.createElement("td");
        timeCell.textContent = alert.time;
        row.appendChild(timeCell);
        
        // Location column
        const locationCell = document.createElement("td");
        locationCell.textContent = alert.location;
        row.appendChild(locationCell);
        
        // Status column
        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");
        statusBadge.className = `status-badge ${alert.status.toLowerCase()}`;
        statusBadge.textContent = alert.status;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        
        // Response column
        const responseCell = document.createElement("td");
        responseCell.textContent = alert.response;
        row.appendChild(responseCell);
        
        // Add the row to the table
        historyBody.appendChild(row);
    });
}

// Function to update the ambulance table
function updateAmbulanceTable() {
    const tableBody = document.getElementById("ambulance-table-body");
    
    // Clear the existing rows
    tableBody.innerHTML = "";
    
    // Update counters
    let availableCount = 0;
    let dispatchedCount = 0;
    
    // Add the ambulance data to the table
    ambulanceData.forEach(ambulance => {
        const row = document.createElement("tr");
        
        // Count status
        if (ambulance.status === "Available") {
            availableCount++;
        } else if (ambulance.status === "Dispatched") {
            dispatchedCount++;
        }
        
        // ID column
        const idCell = document.createElement("td");
        idCell.textContent = ambulance.id;
        row.appendChild(idCell);
        
        // Status column
        const statusCell = document.createElement("td");
        const statusBadge = document.createElement("span");
        statusBadge.className = `status-badge ${ambulance.status.toLowerCase()}`;
        statusBadge.textContent = ambulance.status;
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        
        // Location column
        const locationCell = document.createElement("td");
        locationCell.textContent = ambulance.location;
        row.appendChild(locationCell);
        
        // ETA column
        const etaCell = document.createElement("td");
        etaCell.textContent = ambulance.eta;
        row.appendChild(etaCell);
        
        // Add the row to the table
        tableBody.appendChild(row);
    });
    
    // Update count displays
    document.getElementById("available-count").textContent = availableCount;
    document.getElementById("dispatched-count").textContent = dispatchedCount;
}

// Function to handle ambulance dispatch
function dispatchAmbulance() {
    // Find an available ambulance
    const availableIndex = ambulanceData.findIndex(amb => amb.status === "Available");
    
    if (availableIndex >= 0) {
        // Update ambulance status
        ambulanceData[availableIndex].status = "Dispatched";
        ambulanceData[availableIndex].location = "En route";
        
        // Calculate ETA
        const distanceElement = document.getElementById("distance-to-accident");
        let distance = 5; // Default distance in km
        
        if (distanceElement && distanceElement.textContent) {
            const distanceText = distanceElement.textContent;
            const distanceMatch = distanceText.match(/(\d+\.?\d*)/);
            if (distanceMatch) {
                distance = parseFloat(distanceMatch[1]);
            }
        }
        
        // Calculate ETA
        const eta = calculateETA(distance);
        ambulanceData[availableIndex].eta = eta;
        
        // Update ambulance table
        updateAmbulanceTable();
        
        // Update alert history
        if (alertHistory.length > 0) {
            alertHistory[0].response = `Ambulance ${ambulanceData[availableIndex].id} dispatched`;
            updateAlertHistoryTable();
        }
        
        // Show success message
        alert(`Ambulance ${ambulanceData[availableIndex].id} has been dispatched to the accident location.`);
    } else {
        // No available ambulances
        alert("No available ambulances. Please contact backup services.");
    }
}

// Function to handle alert acknowledgement
function acknowledgeAlert() {
    // Update alert status
    if (alertHistory.length > 0) {
        alertHistory[0].status = "Acknowledged";
        updateAlertHistoryTable();
    }
    
    // Update UI
    const statusLight = document.getElementById("status-light");
    statusLight.className = "status-light warning";
    
    const statusText = document.getElementById("status-text");
    statusText.textContent = "⚠️ INCIDENT ACKNOWLEDGED";
    
    // Show acknowledgement message
    alert("Alert has been acknowledged. Please dispatch emergency services if needed.");
}