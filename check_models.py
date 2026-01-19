
import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load .env to get API Key if possible, or expect it in env
load_dotenv()

api_key = os.getenv('GEMINI_API_KEY')
if not api_key:
    # Try getting from user input or fallback
    print("Warning: GEMINI_API_KEY not found in .env")
    # For this script run, we might need the user to provide it or the efficient method:
    # We will try to read it from server.js logic or just ask user? 
    # Actually, I can read it from the file system if it's there.
    pass

# We will assume the environment variable IS set when running the command 
# or I will pass it explicitly if I can find it.
# Let's try to assume it's in process.env when we run it via node? No, this is python.

if api_key:
    genai.configure(api_key=api_key)

    print("List of available models:")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods or 'predict' in m.supported_generation_methods:
                print(f"Model Name: {m.name}")
                print(f" - Supported Methods: {m.supported_generation_methods}")
    except Exception as e:
        print(f"Error listing models: {e}")
else:
    print("Please set GEMINI_API_KEY environment variable.")
