import whisper

# Load the pre-trained Whisper model
model = whisper.load_model("small")

# Transcribe an audio file
result = model.transcribe("C:\\Users\\shehj\\OneDrive\\Desktop\\chatbot\\audio.wav")

# Print the transcribed text
print(result["text"])