import Editor from './Editor';
import { describeError, describeResponseError, getToastContainer, showToast } from './Toast';

const kSupportedTypes = ['image/', 'video/', 'audio/'];

// IME で変換している途中のキーか。Safari は変換を確定する Enter を isComposing = false・keyCode = 229 で送ってくる。
function isComposing(e: KeyboardEvent): boolean {
  return e.isComposing || e.keyCode === 229;
}

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
  private readonly anchor_: HTMLSpanElement;
  private readonly menu_: HTMLDivElement;
  private readonly urlInput_: HTMLInputElement;
  private readonly embedStatus_: HTMLDivElement;
  constructor(target: HTMLElement, button: HTMLInputElement) {
    this.target_ = target;
    this.button_ = button;
    this.editor_ = null;

    this.fileButton_ = document.createElement('input');
    this.fileButton_.type = 'file';
    this.fileButton_.multiple = true;

    // ↑ を押すと出すサブメニュー。「ファイル」は今までのアップロード、URL の欄は外部（今は YouTube だけ）の動画の埋め込み。
    // ↑ と一緒に包み、包みを基準に ↑ の下へ置く。
    this.anchor_ = document.createElement('span');
    this.anchor_.classList.add('upload-anchor');
    this.button_.parentNode!.insertBefore(this.anchor_, this.button_);
    this.anchor_.appendChild(this.button_);

    this.menu_ = document.createElement('div');
    this.menu_.classList.add('upload-menu');
    this.menu_.hidden = true;
    const fileItem = document.createElement('button');
    fileItem.type = 'button';
    fileItem.textContent = 'ファイル';
    this.menu_.appendChild(fileItem);
    this.urlInput_ = document.createElement('input');
    this.urlInput_.type = 'url';
    this.urlInput_.placeholder = '埋め込む URL（Enter で挿入）';
    this.menu_.appendChild(this.urlInput_);
    // /embed の送信中の表示。アップロードの進捗パネルとは分ける（同時に動いても表示が崩れないように）。
    this.embedStatus_ = document.createElement('div');
    this.embedStatus_.classList.add('upload-status');
    this.embedStatus_.setAttribute('role', 'status');
    this.embedStatus_.textContent = '取り込み中…';
    this.embedStatus_.hidden = true;
    this.menu_.appendChild(this.embedStatus_);
    this.anchor_.appendChild(this.menu_);

    this.button_.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      if (this.menu_.hidden) {
        this.openMenu_();
      } else {
        this.closeMenu_();
      }
    }, false);
    fileItem.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      this.closeMenu_();
      this.fileButton_.click();
    }, false);
    this.urlInput_.addEventListener('keydown', (e: KeyboardEvent) => {
      // 変換の確定の Enter では送らない
      if (e.key === 'Enter' && !isComposing(e)) {
        e.preventDefault();
        this.insertEmbed_(this.urlInput_.value.trim());
      }
    });
    // メニューの中の、URL の欄以外を押してもフォーカスを欄から動かさない（押しただけでは閉じないように）。
    this.menu_.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.target !== this.urlInput_) {
        e.preventDefault();
      }
    });
    // 外側のクリックと Esc、外へのフォーカスの移動で閉じる
    document.addEventListener('mousedown', (e: MouseEvent) => {
      if (!this.menu_.hidden && !this.anchor_.contains(e.target as Node)) {
        this.closeMenu_();
      }
    });
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      // 変換を取り消す Esc では閉じない
      if (e.key === 'Escape' && !isComposing(e) && !this.menu_.hidden) {
        this.closeMenu_();
        this.button_.focus();
      }
    });
    this.anchor_.addEventListener('focusout', (e: FocusEvent) => {
      // 移った先が分からない（null）ときは、外側のクリックと window の blur に任せる
      const next = e.relatedTarget as Node | null;
      if (!this.menu_.hidden && next !== null && !this.anchor_.contains(next)) {
        this.closeMenu_();
      }
    });
    // プレビューの iframe（YouTube のプレイヤー）の中を押したときは document に mousedown が来ないので、
    // window からフォーカスが外れたことで閉じる。
    window.addEventListener('blur', () => {
      if (!this.menu_.hidden) {
        this.closeMenu_();
      }
    });
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

  private openMenu_() {
    this.menu_.hidden = false;
    this.urlInput_.focus();
  }

  private closeMenu_() {
    this.menu_.hidden = true;
  }

  // 外部（今は YouTube だけ）の動画の URL を /embed に送り、返った fml を本文に挿入する。
  private insertEmbed_(url: string) {
    if (url.length === 0 || this.urlInput_.readOnly) {
      return;
    }
    // disabled にするとフォーカスが外れるので、送信中は readOnly にする。
    this.urlInput_.readOnly = true;
    this.embedStatus_.hidden = false;
    fetch('/embed', {
      method: 'POST',
      body: JSON.stringify({ url }),
      headers: {
        'Accept': 'text/plain',
        'Content-Type': 'application/json',
      },
    })
      .then(resp =>
        resp.status === 200 ?
          resp.text() :
          describeResponseError(resp).then(reason => Promise.reject(new Error(reason))))
      .then(embed => {
        this.urlInput_.value = '';
        this.closeMenu_();
        this.editor_!.onUpload([embed]);
        return true;
      })
      .catch(err => {
        // 欄の URL は残し、直して送り直せるようにする
        console.error(err);
        showToast(`埋め込みに失敗しました: ${describeError(err)}`);
        return false;
      })
      .then(ok => {
        this.embedStatus_.hidden = true;
        this.urlInput_.readOnly = false;
        if (ok) {
          this.editor_!.focusText();
        } else if (!this.menu_.hidden) {
          this.urlInput_.focus();
        }
      });
  }

  private upload_(files_: FileList) {
    const files: File[] = Array.from(files_);
    const unsupported = files.filter(file => !kSupportedTypes.some(type => file.type.startsWith(type)));
    if (unsupported.length > 0) {
      showToast(`アップロードできない形式です: ${unsupported.map(file => file.name).join(', ')}`);
      return;
    }

    getToastContainer().appendChild(this.progressDialog_);
    this.progressBar_.max = files.length;
    // 同じページで前に上げたときの値が残っていると、最初から満タンに見える
    this.progressBar_.value = 0;

    const embeds: string[] = [];

    const upload: (i: number) => Promise<boolean> = (i: number) => new Promise((resolve, reject) => {
      this.progressImage_.src = '';
      const file = files[i];
      const execUpload = () =>
        fetch('/upload', {
          method: 'POST',
          body: file,
        })
        .then(resp =>
          resp.status === 200 ?
            resp.text() :
            describeResponseError(resp).then(reason => Promise.reject(new Error(reason))))
        // 接続の失敗(Failed to fetch)にもファイル名を付ける。次のファイルの失敗に二重に付けないよう、ここで受ける
        .catch(err => Promise.reject(new Error(`${file.name}: ${describeError(err)}`)))
        .then(resp => {
          embeds.push(resp);
          this.progressBar_.value = i+1;
          return (i + 1) < files.length ? upload(1 + i) : Promise.resolve(true);
        });
      if(file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        this.progressImage_.src = url;
        execUpload().finally(() => URL.revokeObjectURL(url)).then(resolve, reject);
      } else if (file.type.startsWith('video/')) {
        execUpload().then(resolve, reject);
      } else if (file.type.startsWith('audio/')) {
        execUpload().then(resolve, reject);
      } else {
        // kSupportedTypes で弾いているので来ないはずだが、来ても進捗パネルを出したままにしない
        reject(new Error(`${file.name}: アップロードできない形式です`));
      }
    });

    upload(0).then(() => {
      this.progressDialog_.remove();
      this.editor_!.onUpload(embeds);
    }).catch((err) => {
      console.error(err);
      this.progressDialog_.remove();
      showToast(`アップロードに失敗しました: ${describeError(err)}`);
    });
  }


  private onDrop_(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    if(!!this.hoverDialog_.parentNode) {
      this.target_.removeChild(this.hoverDialog_);
    }
    this.upload_(e.dataTransfer!.files);
  }

  private onDragStart_(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    if(!this.hoverDialog_.parentNode) {
      this.target_.appendChild(this.hoverDialog_);
    }
  }

  private onDragEnd_(e: DragEvent) {
    e.stopPropagation();
    e.preventDefault();
    if(!!this.hoverDialog_.parentNode) {
      this.target_.removeChild(this.hoverDialog_);
    }
  }

  private onButtonChange_(e: Event) {
    e.preventDefault();
    if(this.fileButton_.files == null || this.fileButton_.files.length <= 0) {
      return;
    }
    this.upload_(this.fileButton_.files);
  }
}
