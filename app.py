from flask import Flask, render_template, Response, jsonify, request,redirect,url_for
import cv2
import time
import os
import json
from ultralytics import YOLO
import threading
import datetime
import requests

# Make sure to explicitly define static_folder
app = Flask(__name__, static_folder='static', template_folder='templates')

# Global variables
accident_detected = False
accident_location = "Unknown"
last_accident_time = None
accident_details = "No details available"
accident_image = None
notification_sent = False
hospitals_notified = []

# Initialize YOLO model
model = YOLO('./ML_Part/Models/last.pt')

# Function to send SMS alert to hospital
def send_sms_alert(location, details):
    global hospitals_notified
    
    # In a real scenario, you would use a service like Twilio
    # This is a placeholder that simulates sending an SMS
    print(f"SMS ALERT: Accident detected at {location}. Details: {details}")
    
    # Add hospital to notified list
    hospitals = [
        {"name": "City General Hospital", "phone": "+1234567890", "location": "Downtown"},
        {"name": "Memorial Hospital", "phone": "+9876543210", "location": "Uptown"},
        {"name": "St. Mary's Medical Center", "phone": "+5551234567", "location": "Westside"}
    ]
    
    # Find nearest hospital (in a real app, would use actual distance calculation)
    nearest_hospital = hospitals[0]  # For demo purposes, just take the first one
    
    # Add to notified list
    if nearest_hospital["name"] not in hospitals_notified:
        hospitals_notified.append(nearest_hospital["name"])
    
    # You would integrate with Twilio or another SMS service like this:
    """
    from twilio.rest import Client
    
    account_sid = 'your_account_sid'
    auth_token = 'your_auth_token'
    client = Client(account_sid, auth_token)
    
    message = client.messages.create(
        body=f'ALERT: Accident detected at {location}. Details: {details}',
        from_='+1234567890',  # Your Twilio number
        to=nearest_hospital["phone"]
    )
    """
    return True

# Function to generate frames from video feed with accident detection
def generate_frames():
    global accident_detected, accident_location, last_accident_time, accident_details, accident_image, notification_sent
    
    # Choose whether to use a video file or camera feed
    use_video_file = True
    if use_video_file:
        video_path = "ML_Part/Videos/testing2.mp4"
        cap = cv2.VideoCapture(video_path)
    else:
        cap = cv2.VideoCapture(0)  # Use 0 for default camera
        
    if not cap.isOpened():
        print("Error: Could not open video source")
        return
    
    # Get video properties for saving frames
    frame_width = int(cap.get(3))
    frame_height = int(cap.get(4))
    
    while True:
        success, frame = cap.read()
        if not success:
            # If the video ends, restart it
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
            
        # Run YOLOv8 inference on the frame
        results = model(frame)
        
        detected_this_frame = False
        
        for result in results:
            boxes = result.boxes.cpu().numpy()
            for box in boxes:
                if box.conf[0] > 0.5:  # Confidence threshold
                    # Accident detected
                    detected_this_frame = True
                    frame = results[0].plot()  # Draw bounding boxes
                    
                    # Update global variables if this is a new accident or if cooldown period passed
                    current_time = time.time()
                    if not accident_detected or (last_accident_time and current_time - last_accident_time > 60):
                        accident_detected = True
                        last_accident_time = current_time
                        notification_sent = False  # Reset notification status
                        
                        # In a real app, you'd get this from GPS or mapping service
                        accident_location = "Main Street & 5th Avenue"
                        accident_details = f"Accident detected at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                        
                        # Create directory if it doesn't exist
                        os.makedirs('static/accident_frames', exist_ok=True)
                        accident_image_path = f"static/accident_frames/accident_{int(time.time())}.jpg"
                        cv2.imwrite(accident_image_path, frame)
                        accident_image = accident_image_path
                        
                    # Send notification if not sent already
                    if not notification_sent:
                        # Send SMS alert in a separate thread to avoid blocking
                        threading.Thread(
                            target=send_sms_alert, 
                            args=(accident_location, accident_details)
                        ).start()
                        notification_sent = True
        
        # If no accident detected in this frame but we previously detected one
        if not detected_this_frame and accident_detected:
            # Reset after some time if needed
            if last_accident_time and time.time() - last_accident_time > 30:
                accident_detected = False
                notification_sent = False
        
        # Encode the frame for streaming
        ret, buffer = cv2.imencode('.jpg', frame)
        frame = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/hospital_login')
def hospital_login():
    return render_template('hospital_login.html')

@app.route('/register')
def register():
    if request.method== 'POST':
         return redirect(url_for('hospital_login.html'))
    return render_template('register.html')

@app.route('/police')
def police_dashboard():
    return render_template('police.html')

@app.route('/hospital')
def hospital_dashboard():
    return render_template('hospital.html')





@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), 
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/accident_status')
def accident_status():
    global accident_detected, accident_location, last_accident_time, accident_details, accident_image, hospitals_notified
    
    return jsonify({
        'detected': accident_detected,
        'location': accident_location,
        'time': datetime.datetime.fromtimestamp(last_accident_time).strftime('%Y-%m-%d %H:%M:%S') if last_accident_time else None,
        'details': accident_details,
        'image': accident_image,
        'hospitals_notified': hospitals_notified
    })

@app.route('/reset_accident', methods=['POST'])
def reset_accident():
    global accident_detected, notification_sent
    
    accident_detected = False
    notification_sent = False
    
    return jsonify({'status': 'success', 'message': 'Accident status reset'})

@app.route('/api/send_notification', methods=['POST'])
def send_notification_api():
    """API endpoint to send SMS notifications manually or from external systems"""
    if not request.is_json:
        return jsonify({'error': 'Request must be JSON'}), 400
        
    data = request.get_json()
    
    # Validate required fields
    required_fields = ['location', 'details', 'recipient_type']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    location = data['location']
    details = data['details']
    recipient_type = data['recipient_type']  # 'police', 'hospital', or 'both'
    
    # Optional fields
    recipient_number = data.get('recipient_number')
    
    success = False
    
    if recipient_type in ['hospital', 'both']:
        # Send to hospital
        success = send_sms_alert(location, details)
    
    if recipient_type in ['police', 'both']:
        # For police, you might have a different notification function
        # Or use the same one with different parameters
        success = True  # Placeholder
    
    if success:
        return jsonify({'status': 'success', 'message': 'Notification sent successfully'})
    else:
        return jsonify({'status': 'error', 'message': 'Failed to send notification'}), 500

@app.route('/api/accident_history', methods=['GET'])
def get_accident_history():
    """API endpoint to retrieve accident history"""
    # In a real application, you would store this in a database
    # For demo purposes, we'll return mock data
    
    mock_history = [
        {
            'id': 1,
            'time': '2025-04-14 10:15:22',
            'location': 'Main Street & 5th Avenue',
            'details': 'Vehicle collision',
            'status': 'Resolved',
            'response_time': '3 minutes'
        },
        {
            'id': 2,
            'time': '2025-04-13 15:42:10',
            'location': 'Highway 101, Mile 34',
            'details': 'Single vehicle accident',
            'status': 'Resolved',
            'response_time': '7 minutes'
        },
        {
            'id': 3,
            'time': '2025-04-12 08:30:45',
            'location': 'Oak Street & Park Avenue',
            'details': 'Multi-vehicle collision',
            'status': 'Resolved',
            'response_time': '4 minutes'
        }
    ]
    
    # If accident_detected is True, add it to the history
    global accident_detected, accident_location, last_accident_time, accident_details
    
    if accident_detected and last_accident_time:
        current_accident = {
            'id': len(mock_history) + 1,
            'time': datetime.datetime.fromtimestamp(last_accident_time).strftime('%Y-%m-%d %H:%M:%S'),
            'location': accident_location,
            'details': accident_details,
            'status': 'Active',
            'response_time': 'In progress'
        }
        mock_history.insert(0, current_accident)
    
    return jsonify(mock_history)

if __name__ == '__main__':
    app.run(debug=True)
