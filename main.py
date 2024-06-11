import eel
import sys, os
import cv2
import base64
import json
import time
import numpy as np
from tkinter import Tk
from tkinter.filedialog import askopenfilename
from sewar.full_ref import uqi


def resource_path(relative_path):
	base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
	return os.path.join(base_path, relative_path)


def similarity_by_fragment(image1, image2):
	return round(uqi(image1, image2) * 100)

def similarity_by_fullframe(image1, image2):
	gray_image1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
	gray_image2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)
	orb = cv2.ORB_create()
	# Находим ключевые точки и дескрипторы с помощью ORB
	keypoints1, descriptors1 = orb.detectAndCompute(gray_image1, None)
	keypoints2, descriptors2 = orb.detectAndCompute(gray_image2, None)
	# Используем BFMatcher для поиска ближайших соседей
	bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
	# Сопоставляем дескрипторы
	matches = bf.knnMatch(descriptors1, descriptors2, k=2)
	# Применяем соотношение теста Лоу для отбора хороших совпадений
	good_matches = []
	for m, n in matches:
		if m.distance < 0.85 * n.distance:
			good_matches.append(m)
	num_good_matches = len(good_matches)
	return round((num_good_matches / max(len(keypoints1), len(keypoints2))) * 100)


@eel.expose
def ask_file(filetype=""):
	root = Tk()
	root.withdraw()
	root.wm_attributes('-topmost', 1)
	filetypes = [("All files", "*.*")]
	if filetype == "image":
		filetypes.insert(0, ("Images", "*.jpg;*.png"))
	elif filetype == "video":
		filetypes.insert(0, ("Videos", "*.mp4"))
	elif filetype == "config":
		filetypes.insert(0, ("Config file", "*.json"))
	file = askopenfilename(parent=root, filetypes=filetypes)
	if file: return file

@eel.expose
def get_file_image(filepath):
	with open(filepath, "rb") as file:
		string = base64.b64encode(file.read()).decode('utf-8')
		ext = filepath.split('.')[-1]
		return f'data:image/{ext};base64,{string}'

def humanize_time(milliseconds):
    seconds, milliseconds = divmod(milliseconds, 1000)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return "{:02d}:{:02d}:{:02d}".format(hours, minutes, seconds)

@eel.expose
def get_frame(video_path, frame_index):
	cap = cv2.VideoCapture(video_path)
	cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
	ret, frame = cap.read()
	timestamp = round(cap.get(cv2.CAP_PROP_POS_MSEC))
	cap.release()
	retval, buffer = cv2.imencode('.jpg', frame)
	string = base64.b64encode(buffer).decode('utf-8')
	return f'data:image/jpeg;base64,{string}', humanize_time(timestamp)



@eel.expose
def analyze_video(video_path, base64_image, algorithm):
	base64_string = base64_image.split(',')[1]
	image_data = base64.b64decode(base64_string)
	np_arr = np.frombuffer(image_data, np.uint8)
	reference_image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

	cap = cv2.VideoCapture(video_path)
	width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
	height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
	length = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
	reference_image = cv2.resize(reference_image, (width, height), interpolation=cv2.INTER_AREA)

	if algorithm == "fragment":
		calculate_image_similarity = similarity_by_fragment
	else:
		calculate_image_similarity = similarity_by_fullframe

	frames_array = []
	frame_number = 0
	while True:
		ret, frame = cap.read()
		if not ret: break
		frame_number += 1
		eel.analyze_progress(frame_number, length)()

		similarity_percentage = calculate_image_similarity(frame, reference_image)
		frames_array.append((frame_number, similarity_percentage))
	cap.release()

	filename = f'result_{int(time.time())}.json'
	with open(filename, 'w', encoding='utf8') as file:
		file.write(json.dumps({
			'algorithm': algorithm,
			'video': video_path,
			'image': base64_image,
			'frames': frames_array
		}, ensure_ascii=False))
	return filename


@eel.expose
def loadResults(results_file):
	with open(results_file, 'r', encoding='utf8') as file:
		data = json.loads(file.read())
	return {
		"image": data['image'],
		"video": data["video"],
		"algorithm": data.get('algorithm')
	}

@eel.expose
def getSimilarFrames(results_file, similarity_degree):
	results = []
	with open(results_file, 'r', encoding='utf8') as file:
		data = json.loads(file.read())
		for result in data['frames']:
			if result[1] >= similarity_degree:
				results.append(result)
	return sorted(results, key=lambda x:x[1], reverse=True)



eel.init(resource_path("web"))
eel.start("index.html")
