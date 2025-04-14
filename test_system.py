import requests
import time
import os
import unittest
import json
import threading
import subprocess
import signal
import sys

# This script tests the accident detection system's API endpoints
# and can be used to verify that the system is working correctly

class AccidentDetectionSystemTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Start the Flask server in a separate process
        cls.flask_process = None
        try:
            # Check if the server is already running
            response = requests.get('http://localhost:5000')
            print("Server is already running, skipping server start")
        except requests.exceptions.ConnectionError:
            print("Starting Flask server...")
            # Start the server
            cls.flask_process = subprocess.Popen(
                [sys.executable, 'app.py'],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            # Give the server time to start
            time.sleep(3)
    
    @classmethod
    def tearDownClass(cls):
        # Stop the Flask server if we started it
        if cls.flask_process:
            print("Stopping Flask server...")
            cls.flask_process.terminate()
            cls.flask_process.wait()
    
    def test_index_page(self):
        """Test that the index page loads correctly"""
        response = requests.get('http://localhost:5000')
        self.assertEqual(response.status_code, 200)
        self.assertIn('CCTV Accident Detection System', response.text)
    
    def test_police_dashboard(self):
        """Test that the police dashboard loads correctly"""
        response = requests.get('http://localhost:5000/police')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Police Dashboard', response.text)
    
    def test_hospital_dashboard(self):
        """Test that the hospital dashboard loads correctly"""
        response = requests.get('http://localhost:5000/hospital')
        self.assertEqual(response.status_code, 200)
        self.assertIn('Hospital Emergency Dashboard', response.text)
    
    def test_accident_status_api(self):
        """Test the accident status API"""
        response = requests.get('http://localhost:5000/accident_status')
        self.assertEqual(response.status_code, 200)
        
        # Check that the response is valid JSON
        data = response.json()
        self.assertIn('detected', data)
        self.assertIn('location', data)
    
    def test_send_notification_api(self):
        """Test the send notification API"""
        payload = {
            'location': 'Test Location',
            'details': 'Test accident for API verification',
            'recipient_type': 'both'
        }
        
        response = requests.post(
            'http://localhost:5000/api/send_notification',
            json=payload
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'success')
    
    def test_accident_history_api(self):
        """Test the accident history API"""
        response = requests.get('http://localhost:5000/api/accident_history')
        self.assertEqual(response.status_code, 200)
        
        # Check that the response is valid JSON and contains accident records
        data = response.json()
        self.assertTrue(isinstance(data, list))
        if len(data) > 0:
            self.assertIn('id', data[0])
            self.assertIn('time', data[0])
            self.assertIn('location', data[0])
    
    def test_invalid_notification_request(self):
        """Test handling of invalid notification requests"""
        # Missing required field
        payload = {
            'location': 'Test Location',
            # 'details' field missing
            'recipient_type': 'both'
        }
        
        response = requests.post(
            'http://localhost:5000/api/send_notification',
            json=payload
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)
        self.assertIn('Missing required field', data['error'])
    
    def test_non_json_notification_request(self):
        """Test handling of non-JSON notification requests"""
        response = requests.post(
            'http://localhost:5000/api/send_notification',
            data='This is not JSON'
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)
        self.assertEqual('Request must be JSON', data['error'])

if __name__ == '__main__':
    print("Running integration tests for CCTV Accident Detection System")
    unittest.main()