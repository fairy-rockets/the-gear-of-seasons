import Editor from "./Editor";

export default class Uploader {
  /**
   * 
   * @param {HTMLElement} target 
   * @param {HTMLInputElement} button
   */
  constructor(target, button) {
    this.target_ = target;
    this.button_ = button;
    /**
     * @member {Editor} editor_
     * @private
     */
    this.editor_ = null;

    /** @member {HTMLInputElement} fileButton_ */
    this.fileButton_ = document.createElement('input');
    this.fileButton_.type = 'file';
    this.fileButton_.multiple = true;
    this.button_.addEventListener('click', (e) => {
      e.preventDefault();
      this.fileButton_.click();
    }, false);
    this.fileButton_.addEventListener('change', this.onButtonChange_.bind(this));

    this.dragStartListener_ = this.onDragStart_.bind(this);
    this.dragEndListener_ = this.onDragEnd_.bind(this);
    this.dropListener_ = this.onDrop_.bind(this);

    this.hoverDialog_ = document.createElement('div');
    this.hoverDialog_.classList.add('uploader-hover');
    this.hoverDialog_.textContent = '⬆';

    /** @member {HTMLDivElement} */
    this.progressDialog_ = document.createElement('div');
    this.progressDialog_.classList.add('uploader-progress');
    /** @member {HTMLImageElement} */
    this.progressImage_ = document.createElement('img');
    this.progressDialog_.appendChild(this.progressImage_);
    /** @member {HTMLProgressElement} */
    this.progressBar_ = document.createElement('progress');
    this.progressDialog_.appendChild(this.progressBar_);
  }
  /**
   * 
   * @param {Editor} editor 
   */
  init(editor) {
    this.editor_ = editor;

    this.target_.addEventListener('dragover', this.dragStartListener_, false);

    this.hoverDialog_.addEventListener('drop', this.dropListener_, false);
    this.hoverDialog_.addEventListener('dragleave', this.dragEndListener_, false);
    this.hoverDialog_.addEventListener('dragend', this.dragEndListener_, false);
  }

  /**
   * 
   * @param {FileList} files 
   */
  upload_(files_) {
    this.target_.appendChild(this.progressDialog_);
    /** @type {File[]} files */
    const files = Array.from(files_);
    this.progressBar_.max = files.length;

    /** @type {string[]} */
    const embeds = [];

    /**
     * @param {number} i
     * @returns {Promise<boolean>}
     */
    const upload = (i) => new Promise((resolve, reject) => {
      this.progressImage_.src = '';
      const file = files[i];
      const execUpload = () => {
        fetch('/upload', {
          method: 'POST',
          body: file,
        })
        .then(resp =>
          resp.status === 200 ?
            resp.text() :
            resp.text().then(reason => Promise.reject(`${resp.status}(${resp.statusText}): ${reason}`)))
        .then(resp => {
          embeds.push(resp);
          this.progressBar_.value = i+1;
          return (i + 1) < files.length ? upload(1 + i) : Promise.resolve(true);
        }).then(resolve, reject);  
      };
      if(file.type.startsWith('image/')){
        const fr = new FileReader();
        fr.onload = event => {
          this.progressImage_.onload = (event) => execUpload();
          this.progressImage_.src = event.target.result;
        };
        fr.onerror = ev => reject(fr.error);
        fr.onabort = ev => reject(fr.error);
        fr.readAsDataURL(file);
      } else if(file.type.startsWith('video/')) {
        execUpload();
      }
    });

    upload(0).then(() => {
      this.target_.removeChild(this.progressDialog_);
      this.editor_.onUpload(embeds);
    }).catch((err) => {
      console.error(err);
      this.target_.removeChild(this.progressDialog_);
    });
  }

  /**
   * @param {DragEvent} e
   */
  onDrop_(e) {
    e.stopPropagation();
    e.preventDefault();
    if(!!this.hoverDialog_.parentNode) {
      this.target_.removeChild(this.hoverDialog_);
    }
    this.upload_(e.dataTransfer.files);
  }

  /**
   * @param {DragEvent} e
   */
  onDragStart_(e) {
    e.stopPropagation();
    e.preventDefault();
    if(!this.hoverDialog_.parentNode) {
      this.target_.appendChild(this.hoverDialog_);
    }
  }

  /**
   * @param {DragEvent} e
   */
  onDragEnd_(e) {
    e.stopPropagation();
    e.preventDefault();
    if(!!this.hoverDialog_.parentNode) {
      this.target_.removeChild(this.hoverDialog_);
    }
  }

  /**
   * 
   * @param {Event} e 
   */
  onButtonChange_(e) {
    e.preventDefault();
    if(this.fileButton_.files.length <= 0) {
      return;
    }
    this.upload_(this.fileButton_.files);
  }
}