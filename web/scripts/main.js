window.onload = _=>{
	initTabs();
	initInputs();
}


function initInputs(){
	new CustomFileInput(document.querySelector("#video_input"))
	let image_input = new CustomFileInput(document.querySelector("#reference_image_input"))
	image_input.onchange(async value=>{
		function displayImage(image){
			image_input.root.querySelector("img").src = image
		}

		if (typeof value === 'string'){
			let image = await eel.get_file_image(value)()
			displayImage(image)
		} else{
			const reader = new FileReader();
			reader.addEventListener("load", _=>{
				displayImage(reader.result)
			});
			reader.readAsDataURL(value);
		}
	})
	let result_config_input = new CustomFileInput(document.querySelector("#result_file_input"))
	result_config_input.onchange(value=>{
		resulter(value)
	})
}


function initTabs(){
	document.querySelectorAll("#tabs .tab").forEach(tab=>{
		tab.onclick = _=>{
			openTab(tab.getAttribute("target"))
		}
	})
}
function openTab(tabname){
	let target_tab = document.querySelector(`#tabs .tab[target="${tabname}"]`)
	if (!target_tab.classList.contains("active")){
		let old_tab = document.querySelector("#tabs .tab.active");
		let old_content = document.querySelector("#tab-content .page.visible")
		old_tab.classList.remove("active")
		old_content.classList.remove("visible")

		let target_page = document.querySelector(`#tab-content .page[name="${tabname}"]`)
		target_tab.classList.add("active")
		target_page.classList.add("visible")
	}
}


document.querySelector("#search_button").onclick = async _=>{
	let reference_image = document.querySelector("#reference_image_input input")
	let target_video = document.querySelector('#video_input input')
	if (!reference_image.value){
		document.querySelector("#reference_image_input").classList.add("invalid")
		return
	}
	if (!target_video.value){
		document.querySelector('#video_input').classList.add("invalid")
		return
	}
	document.querySelector("#search_button").disabled = true;
	let image = document.querySelector("#reference_image_input img")
	let file = await eel.analyze_video(target_video.value, image.src)()
	resulter(file)
}

async function resulter(config_file){
	openTab('results')
	document.querySelector("#similarity_degree").setAttribute("results", config_file)
	let config = await eel.loadResults(config_file)();
	document.querySelector("#similarity_degree").setAttribute("video", config["video"])
	document.querySelector("#reference_image_result").src = config['image']

	let similarity_input = document.querySelector("#similarity_degree input")
	similarity_input.value = 90;
	similarity_input.onchange()
}

eel.expose(analyze_progress)
function analyze_progress(current, total){
	document.querySelector("#analyze_progress progress").value = current
	document.querySelector("#analyze_progress progress").max = total
	let percent = Math.round(current / total * 100);
	document.querySelector("#analyze_progress span").innerHTML = `${percent}%`
}


document.querySelector("#similarity_degree input").oninput = _=>{
	let value = document.querySelector("#similarity_degree input").value;
	document.querySelector("#similarity_degree span").innerHTML = `${value}%`
}
document.querySelector("#similarity_degree input").onchange = async _=>{
	let input = document.querySelector("#similarity_degree input")
	document.querySelector("#result_area").innerHTML = ""
	input.disabled = true

	let target_file = document.querySelector("#similarity_degree").getAttribute("results");
	let frames = await eel.getSimilarFrames(target_file, parseInt(input.value))()
	let video_file = document.querySelector("#similarity_degree").getAttribute("video")
	await displayResults(video_file, frames)

	input.disabled = false
}

async function displayResults(video_file, frames){
	for (const result of frames) {
        let [data_image, timestamp] = await eel.get_frame(video_file, result[0])()
		let el = document.createElement("div")
		el.setAttribute("similarity", result[1])
		el.setAttribute("time", timestamp)
		el.title = timestamp
		let image = document.createElement("img")
		image.src = data_image;
		el.appendChild(image)
		document.querySelector("#result_area").appendChild(el)
    }
}

class CustomFileInput{
	constructor(element) {
		this.root = element
		this.mime = this.root.getAttribute("mime")
		this.input = this.root.querySelector("input")
		this.button = this.root.querySelector("label.button")
		this.filename = this.root.querySelector("label.filename")
		this._onchange = _=>{}
		this._changeFile = (name, file) =>{
			this.root.classList.remove("invalid")
			if (typeof file === 'string'){
				this.input.value = file;
			} else {
				this.input.value = name;
			}
			this.filename.innerHTML = name;
			this._onchange(file);
		}

		this.button.onclick = async _=>{
			let file = await eel.ask_file(this.mime)();
			if (file){
				this._changeFile(file.replace(/^.*[\\/]/, ''), file)
			}
		}
		if (!this.root.hasAttribute("local")){
			this.root.ondragover = e=>{
				e.preventDefault()
				this.root.classList.add("drag-active")
			}
			this.root.ondragleave = _=>{
				this.root.classList.remove("drag-active")
			}
			this.root.ondrop = e=>{
				e.preventDefault();
				this.root.classList.remove("drag-active")
				let file = e.dataTransfer.files[0]
				if (file){
					if (file.type.startsWith(this.mime)){
						this._changeFile(file.name, file)
					}
				}
			}

			if (this.root.hasAttribute("buffer")){
				document.body.addEventListener("paste", e=>{
					if (this.root.offsetParent != null){ // visible
						let clipboardData = e.clipboardData || window.clipboardData;
						let file = clipboardData.files[0]
						if (file){
							this._changeFile(file.name, file)
						}
					}
				});
			}
		}
	}
	onchange(func){
		this._onchange = func
	}
}
