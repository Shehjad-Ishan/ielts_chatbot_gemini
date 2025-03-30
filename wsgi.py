import os
import sys
import json
from app import app, init_app
from waitress import serve

def load_user_count():
    """Load user count from command line or config file"""
    # Check command line arguments first
    if len(sys.argv) > 1:
        try:
            user_count = int(sys.argv[1])
            return user_count
        except ValueError:
            print(f"Warning: Invalid user count '{sys.argv[1]}'. Using default from config.")
    
    # Check config file
    config_path = 'config.json'
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                return config.get('expected_users', 100)
        except Exception as e:
            print(f"Error loading config: {str(e)}")
    
    # Default value
    return 100

if __name__ == "__main__":
    # Create necessary directories
    os.makedirs('static/voices', exist_ok=True)
    os.makedirs('logs', exist_ok=True)
    
    # Get expected user count
    expected_users = load_user_count()
    
    # Initialize app with expected user count
    settings = init_app(expected_users)
    
    print(f"Starting server with Waitress configured for {expected_users} users...")
    print(f"Server settings: {settings}")
    
    serve(app, 
          host='0.0.0.0', 
          port=80, 
          threads=settings['threads'],
          connection_limit=settings['connections'],
          cleanup_interval=30,
          channel_timeout=120)