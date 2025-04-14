// Global variables
let map;
let marker;
let alertHistory = [];
let currentStatus = "normal"; // normal, warning, danger
let alertSound = document.getElementById("alert-sound");

// Initialize when the document is loaded
document.addEventListener("DOMContentLoaded", function() {
    // Update the current time
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    
    // Initialize the map
    initMap();
    
    // Start polling for accident status
    checkAccidentStatus();
    setInterval(checkAccidentStatus, 3000);
});

// Function to update the current time display
function updateCurrentTime() {
    const now = new Date();
    document.getElementById("current-time").textContent = now.toLocaleTimeString();
}

// Initialize the map
function initMap() {
    // Center on a default location
    const defaultLocation = [40.7128, -74.0060]; // New York City
    
    map = L.map('map').setView(defaultLocation, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add a default marker
    marker = L.marker(defaultLocation).addTo(map);
}

// Function to check the accident status
function checkAccidentStatus() {
    fetch('/accident_status')
        .then(response => response.json())
        .then(data => {
            updateDashboard(data);
        })
        .catch(error => {
            console.error('Error fetching accident status:', error);
        });
}

// Function to update the dashboard with accident data
function updateDashboard(data) {
    const statusLight = document.getElementById("status-light");
    const statusText = document.getElementById("status-text");
    const accidentInfo = document.getElementById("accident-info");
    const accidentImageContainer = document.getElementById("accident-image-container");
    
    if (data.detected) {
        // Update status indicator
        statusLight.className = "status-light danger";
        statusText.textContent = "⚠️ ACCIDENT DETECTED";
        
        // Show accident info
        accidentInfo.classList.remove("hidden");
        
        // Update accident details
        document.getElementById("accident-time").textContent = `Time: ${data.time}`;
        document.getElementById("accident-location").textContent = `Location: ${data.location}`;
        document.getElementById("accident-details").textContent = `Details: ${data.details}`;
        
        // Update accident image if available
        if (data.image) {
            document.getElementById("accident-image").src = data.image;
            accidentImageContainer.classList.remove("hidden");
        }
        
        // Update map with accident location
        updateMapLocation(data.location);
        
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

// Function to update the map with the accident location
function updateMapLocation(locationStr) {
    // In a real application, you would geocode the location string
    // For this demo, we'll use random coordinates near a default location
    const baseLocation = [40.7128, -74.0060]; // New York City
    const randomLat = baseLocation[0] + (Math.random() - 0.5) * 0.01;
    const randomLng = baseLocation[1] + (Math.random() - 0.5) * 0.01;
    
    // Update the marker position
    marker.setLatLng([randomLat, randomLng]);
    
    // Center the map on the new location
    map.setView([randomLat, randomLng], 15);
    
    // Update the popup content
    marker.bindPopup(`<b>Accident Location</b><br>${locationStr}`).openPopup();
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
        status: "active"
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
        statusBadge.className = `status-badge ${alert.status}`;
        statusBadge.textContent = alert.status === "active" ? "Active" : "Resolved";
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        
        // Add the row to the table
        historyBody.appendChild(row);
    });
}