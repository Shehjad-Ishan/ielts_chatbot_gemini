from flask import Flask, request, jsonify, send_file, send_from_directory
import requests
import os
import json
import io
import base64
from gtts import gTTS
import logging
import psutil
import gc
from logging.handlers import RotatingFileHandler
from functools import wraps
import time
from google import genai
from google.genai import types
import multiprocessing
import math
from deepmultilingualpunctuation import PunctuationModel

# Configure logging
if not os.path.exists('logs'):
    os.makedirs('logs')

# Ensure notices directory exists
NOTICES_DIR = 'notices'
if not os.path.exists(NOTICES_DIR):
    os.makedirs(NOTICES_DIR)

logging.basicConfig(
    handlers=[RotatingFileHandler('logs/app.log', maxBytes=10000000, backupCount=5)],
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load configuration
def load_config():
    config_path = 'config.json'
    default_config = {
        "expected_users": 100,
        "thread_multiplier": 0.2,  # Threads = users * multiplier
        "connection_multiplier": 1.2,  # Connections = users * multiplier
        "memory_threshold": 85,
        "request_cooldown": 0.2,
        "model_name": "gemini-2.0-pro-exp-02-05",
        "api_key": "AIzaSyBla5K12NNIBKIv5We-PgrXyxsW_SuHqDw"
    }
    
    if os.path.exists(config_path):
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                # Merge with defaults to ensure all keys exist
                for key, value in default_config.items():
                    if key not in config:
                        config[key] = value
            return config
        except Exception as e:
            logger.error(f"Error loading config: {str(e)}")
    
    # Create default config if it doesn't exist
    try:
        with open(config_path, 'w') as f:
            json.dump(default_config, f, indent=4)
    except Exception as e:
        logger.error(f"Error creating default config: {str(e)}")
    
    return default_config

# Calculate optimal server settings based on expected users
def calculate_server_settings(expected_users):
    config = load_config()
    
    # Get multipliers from config
    thread_multiplier = config.get("thread_multiplier", 0.2)
    connection_multiplier = config.get("connection_multiplier", 1.2)
    
    # Calculate optimal values
    cpu_count = multiprocessing.cpu_count()
    available_memory = psutil.virtual_memory().available / (1024 * 1024 * 1024)  # GB
    
    # Calculate threads based on expected users and available CPUs
    optimal_threads = min(
        max(int(expected_users * thread_multiplier), 4),  # Minimum 4 threads
        cpu_count * 4  # Maximum 4 threads per CPU
    )
    
    # Calculate connections
    optimal_connections = min(
        int(expected_users * connection_multiplier),
        5000  # Hard cap at 5000 connections
    )
    
    # Calculate model instances based on available memory
    # Assuming each model instance needs approximately 1GB of memory
    model_instances = max(1, min(int(available_memory / 2), int(expected_users / 200)))
    
    # Calculate memory threshold - lower for higher user counts
    memory_threshold = max(60, 90 - (expected_users / 2000) * 30)
    
    # Calculate request cooldown - lower for higher user counts but with a minimum
    request_cooldown = max(0.1, config.get("request_cooldown", 1.0) * (100 / expected_users))
    
    return {
        "threads": optimal_threads,
        "connections": optimal_connections,
        "model_instances": model_instances,
        "memory_threshold": memory_threshold,
        "request_cooldown": request_cooldown
    }

# Dynamic memory check threshold
def memory_check(threshold=None):
    """Decorator to check memory before and after function execution"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            nonlocal threshold
            if threshold is None:
                app_config = getattr(app, 'config', {})
                threshold = app_config.get('memory_threshold', 85)
                
            process = psutil.Process()
            before_mem = process.memory_percent()
            
            if before_mem > threshold:
                gc.collect()
                logger.warning(f"High memory usage before execution: {before_mem}%")
                
            result = f(*args, **kwargs)
            
            after_mem = process.memory_percent()
            if after_mem > threshold:
                gc.collect()
                logger.warning(f"High memory usage after execution: {after_mem}%")
                
            return result
        return wrapper
    return decorator

# Gemini model class with multiple instances support
class GeminiModel:
    _instances = {}
    _instance_lock = multiprocessing.Lock()
    
    @classmethod
    def get_instance(cls, instance_id=0):
        if instance_id not in cls._instances:
            with cls._instance_lock:
                if instance_id not in cls._instances:
                    cls._instances[instance_id] = cls(instance_id=instance_id)
        return cls._instances[instance_id]
    
    def __init__(self, api_key=None, model_name=None, instance_id=0):
        config = load_config()
        self.model_name = model_name or config.get("model_name")
        self.api_key = api_key or config.get("api_key")
        self.instance_id = instance_id
        self.client = genai.Client(api_key=self.api_key)
        self.last_request_time = 0
        self.request_cooldown = app.config.get('request_cooldown', 1.0) if hasattr(app, 'config') else 1.0
        self._initialize_model()
        logger.info(f"Gemini model instance {instance_id} initialized with model: {self.model_name}")

    def _initialize_model(self):
        try:
            logger.info(f"Initializing Gemini model instance {self.instance_id}: {self.model_name}")
            # Initialize with a simple request to verify connectivity
            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text="Hello"),
                    ],
                ),
            ]
            generate_content_config = types.GenerateContentConfig(
                temperature=1,
                top_p=0.95,
                top_k=64,
                max_output_tokens=1024,
                response_mime_type="text/plain",
            )
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=generate_content_config,
            )
            
            logger.info(f"Gemini model instance {self.instance_id} initialized successfully!")
        except Exception as e:
            logger.error(f"Warning: Could not initialize Gemini model instance {self.instance_id}: {str(e)}")
    
    def chat(self, messages):
        try:
            # Rate limiting
            current_time = time.time()
            time_since_last = current_time - self.last_request_time
            if time_since_last < self.request_cooldown:
                time.sleep(self.request_cooldown - time_since_last)
            
            # Convert messages from Ollama format to Gemini format
            contents = []
            for message in messages:
                role = "user" if message["role"] == "user" else "model"
                contents.append(
                    types.Content(
                        role=role,
                        parts=[
                            types.Part.from_text(text=message["content"]),
                        ],
                    )
                )
            
            generate_content_config = types.GenerateContentConfig(
                temperature=1,
                top_p=0.95,
                top_k=64,
                max_output_tokens=8192,
                response_mime_type="text/plain",
            )
            
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=generate_content_config,
            )
            
            self.last_request_time = time.time()
            
            # Format response to match Ollama's structure
            formatted_response = {
                "message": {
                    "content": response.text
                }
            }
            
            return formatted_response, None
        except Exception as e:
            logger.error(f"Gemini API error (instance {self.instance_id}): {str(e)}")
            return None, str(e)
        finally:
            gc.collect()

# Round-robin load balancer for model instances
class ModelLoadBalancer:
    def __init__(self, num_instances=1):
        self.num_instances = num_instances
        self.current_instance = 0
        self.instances = [GeminiModel.get_instance(i) for i in range(num_instances)]
        logger.info(f"Initialized model load balancer with {num_instances} instances")
    
    def get_next_instance(self):
        instance = self.instances[self.current_instance]
        self.current_instance = (self.current_instance + 1) % self.num_instances
        return instance

# Simplified speech handler
class SpeechHandler:
    def __init__(self):
        self._punctuation_model = None
    
    @property
    def punctuation_model(self):
        if self._punctuation_model is None:
            self._punctuation_model = PunctuationModel()
        return self._punctuation_model
    
    @memory_check(threshold=85)
    def generate_speech(self, text, language='en', slow=False, tld='co.in'):
        try:
            tts = gTTS(text=text, lang=language, slow=slow, tld=tld)
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            return base64.b64encode(audio_buffer.read()).decode('utf-8')
        finally:
            gc.collect()
    
    @memory_check(threshold=85)
    def format_punctuated_text(self, text):
        if not text.strip():
            return text
        
        try:
            clean_text = self.punctuation_model.preprocess(text)
            labeled_words = self.punctuation_model.predict(clean_text)
            
            result = []
            for word, punct, _ in labeled_words:
                if punct != '0':
                    result.append(word + punct)
                else:
                    result.append(word)
            
            final_text = ' '.join(result)
            sentences = final_text.split('. ')
            sentences = [s[0].upper() + s[1:] if len(s) > 0 else s for s in sentences]
            return '. '.join(sentences)
        except Exception as e:
            logger.error(f"Text processing error: {str(e)}")
            return text
        finally:
            gc.collect()

# Initialize handlers lazily
speech_handler = SpeechHandler()

# Create Flask app
app = Flask(__name__, static_folder='static')

# Initialize app with default settings
def init_app(expected_users=None):
    # Load config first
    config = load_config()
    
    # Use provided user count or get from config
    expected_users = expected_users or config.get("expected_users", 100)
    
    # Calculate settings
    settings = calculate_server_settings(expected_users)
    
    # Store settings in app config
    app.config.update({
        'expected_users': expected_users,
        'threads': settings['threads'],
        'connections': settings['connections'],
        'model_instances': settings['model_instances'],
        'memory_threshold': settings['memory_threshold'],
        'request_cooldown': settings['request_cooldown']
    })
    
    # Update config file with new expected_users
    config['expected_users'] = expected_users
    with open('config.json', 'w') as f:
        json.dump(config, f, indent=4)
    
    # Log the settings
    logger.info(f"App initialized for {expected_users} users with settings: {settings}")
    
    return settings

# Lazy initialization of handlers
speech_handler = None
model_balancer = None

def get_speech_handler():
    global speech_handler
    if speech_handler is None:
        speech_handler = SpeechHandler()
    return speech_handler

def get_model_balancer():
    global model_balancer
    if model_balancer is None:
        model_instances = app.config.get('model_instances', 1)
        model_balancer = ModelLoadBalancer(num_instances=model_instances)
    return model_balancer

@app.route('/api/configure', methods=['POST'])
def configure_app():
    try:
        data = request.json
        expected_users = data.get('expected_users', 100)
        
        # Validate input
        if not isinstance(expected_users, int) or expected_users < 1:
            return jsonify({"error": "expected_users must be a positive integer"}), 400
            
        # Initialize app with new user count
        settings = init_app(expected_users)
        
        # Reset model balancer to create new instances with updated settings
        global model_balancer
        model_balancer = None
        
        return jsonify({
            "message": f"Application configured for {expected_users} users",
            "settings": settings
        })
    except Exception as e:
        logger.error(f"Configuration error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        messages = data.get('messages', [])
        
        # Insert a system message at the beginning if it doesn't exist
        if not any(msg.get("role") == "system" for msg in messages):
            messages.insert(0, {
                "role": "system", 
                "content": "You are an IELTS examiner. Evaluate responses professionally and provide constructive feedback."
            })
        
        # Get next available model instance
        model_instance = get_model_balancer().get_next_instance()
        
        # Apply memory check dynamically
        @memory_check(threshold=app.config.get('memory_threshold', 85))
        def execute_chat():
            return model_instance.chat(messages)
        
        response_data, error = execute_chat()
        if error:
            return jsonify({"error": error}), 500
        
        return jsonify({"response": response_data["message"]["content"]})
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/punctuate', methods=['POST'])
def punctuate_text():
    try:
        data = request.json
        text = data.get('text', '')
        result = get_speech_handler().format_punctuated_text(text)
        return jsonify({"text": result})
    except Exception as e:
        logger.error(f"Punctuation endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/tts', methods=['POST'])
def text_to_speech():
    try:
        data = request.json
        audio_data = get_speech_handler().generate_speech(
            text=data.get('text', ''),
            language=data.get('language', 'en'),
            slow=data.get('slow', False),
            tld=data.get('tld', 'co.in')
        )
        return jsonify({"audio": audio_data})
    except Exception as e:
        logger.error(f"TTS endpoint error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/memory', methods=['GET'])
def memory_status():
    process = psutil.Process()
    memory_info = {
        "percent": process.memory_percent(),
        "rss_mb": process.memory_info().rss / 1024 / 1024,
        "vms_mb": process.memory_info().vms / 1024 / 1024
    }
    gc.collect()  # Force garbage collection
    return jsonify(memory_info)

@app.route('/api/status', methods=['GET'])
def app_status():
    return jsonify({
        "expected_users": app.config.get('expected_users', 100),
        "threads": app.config.get('threads', 2),
        "connections": app.config.get('connections', 50),
        "model_instances": app.config.get('model_instances', 1),
        "memory_threshold": app.config.get('memory_threshold', 85),
        "request_cooldown": app.config.get('request_cooldown', 1.0),
        "memory_usage": psutil.Process().memory_percent()
    })

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok"})

# Static file serving
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_static(path):
    if path == "" or not os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, 'index.html')
    return send_from_directory(app.static_folder, path)



# Initialize app with default settings
init_app()