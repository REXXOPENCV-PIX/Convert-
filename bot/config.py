from dotenv import load_dotenv
import os

load_dotenv()

BOT_TOKEN = os.getenv('BOT_TOKEN')
OWNER_IDS = {int(x) for x in os.getenv('OWNER_IDS','').split(',') if x.strip().isdigit()}
DATA_DIR = os.getenv('DATA_DIR', './data')
OUTPUT_DIR = os.getenv('OUTPUT_DIR', './outputs')

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
