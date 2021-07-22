import Editor from "./Editor";

export default class Uploader {
  private readonly target_: HTMLElement;
  private readonly button_: HTMLInputElement;
  private editor_: Editor | null;
  private readonly fileButton_: HTMLInputElement;
  private readonly dragStartListener_: (e: DragEvent) => void;
  private readonly dragEndListener_: (e: DragEvent) => void;
  private readonly dropListener_: (e: DragEvent) => void;
  private readonly hoverDialog_: HTMLDivElement;
  private readonly progressDialog_: HTMLDivElement;
  private readonly progressImage_: HTMLImageElement;
  private readonly progressBar_: HTMLProgressElement;
  constructor(target: HTMLElement, button: HTMLInputElement) {
    this.target_ = target;
    this.button_ = button;
    this.editor_ = null;

    this.fileButton_ = document.createElement('input');
    this.fileButton_.type = 'file';
    this.fileButton_.multiple = true;

    this.button_.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.fileButton_.click();
    }, false);
    this.fileButton_.addEventListener('change', this.onButtonChange_.bind(this));

    this.dragStartListener_ = this.onDragStart_.bind(this);
    this.dragEndListener_ = this.onDragEnd_.bind(this);
    this.dropListener_ = this.onDrop_.bind(this);

    this.hoverDialog_ = document.createElement('div');
    this.hoverDialog_.classList.add('uploader-hover');
    this.hoverDialog_.innerHTML = '<div>⬆</div>';

    this.progressDialog_ = document.createElement('div');
    this.progressDialog_.classList.add('uploader-progress');

    this.progressImage_ = document.createElement('img');
    this.progressDialog_.appendChild(this.progressImage_);

    this.progressBar_ = document.createElement('progress');
    this.progressDialog_.appendChild(this.progressBar_);
  }

  init(editor: Editor) {
    this.editor_ = editor;

    this.target_.addEventListener('dragover', this.dragStartListener_, false);

    this.hoverDialog_.addEventListener('drop', this.dropListener_, false);
    this.hoverDialog_.addEventListener('dragleave', this.dragEndListener_, false);
    this.hoverDialog_.addEventListener('dragend', this.dragEndListener_, false);
  }

  upload_(files_: FileList) {
    this.target_.appendChild(this.progressDialog_);

    const files: File[] = Array.from(files_);
    this.progressBar_.max = files.length;

    const embeds: string[] = [];

    const upload: (i: number) => Promise<boolean> = (i: number) => new Promise((resolve, reject) => {
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
          this.progressImage_.onload = () => execUpload();
          this.progressImage_.src = event.target!.result as string;
        };
        fr.onerror = ev => reject(fr.error);
        fr.onabort = ev => reject(fr.error);
        fr.readAsDataURL(file);
      } else if (file.type.startsWith('video/')) {
        execUpload();
      } else if (file.type.startsWith('audio/')) {
        execUpload();
      }
    });

    upload(0).then(() => {
      this.target_.removeChild(this.progressDialog_);
      this.editor_!.onUpload(embeds);
    }).catch((err) => {
      console.error(err);
      this.target_.removeChild(this.progressDialog_);
    });
  }


  onDrop_(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    if(!!this.hoverDialog_.parentNode) {
      this.target_.removeChild(this.hoverDialog_);
    }
    this.upload_(e.dataTransfer!.files);
  }

  onDragStart_(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    if(!this.hoverDialog_.parentNode) {
      this.target_.appendChild(this.hoverDialog_);
    }
  }

  onDragEnd_(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    if(!!this.hoverDialog_.parentNode) {
      this.target_.removeChild(this.hoverDialog_);
    }
  }

  onButtonChange_(e: Event) {
    e.preventDefault();
    if(this.fileButton_.files == null || this.fileButton_.files.length <= 0) {
      return;
    }
    this.upload_(this.fileButton_.files);
  }
}