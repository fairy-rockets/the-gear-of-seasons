package ura

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"time"

	"github.com/fairy-rockets/the-gear-of-seasons/web/util"
	"github.com/julienschmidt/httprouter"
)

// 新規
func (srv *Server) serveNew(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.templateGen.Parse("admin/_main.html").Parse("admin/edit.html").Bulld()
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		util.SetError(w, r, err)
	}
}

// 各モーメントの編集画面
func (srv *Server) serveEdit(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	var err error
	t, err := srv.templateGen.Parse("admin/_main.html").Parse("admin/edit.html").Bulld()
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	m := srv.shelf.LookupMoment(r.URL.Path)
	if m == nil {
		w.WriteHeader(404)
		return
	}
	w.WriteHeader(200)
	err = t.Execute(w, momentAsPayload(m))
	if err != nil {
		util.SetError(w, r, err)
	}
}

// モーメントのプレビュー（POST）
func (srv *Server) servePreview(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	_, m, err := readMoment(r.Body)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	mc := srv.momentCache.Preview(m)
	w.WriteHeader(200)
	_, err = w.Write([]byte(mc.Content()))
	if err != nil {
		log().Error(err)
	}
}

// モーメントの保存
func (srv *Server) serveSave(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	originalDate, m, err := readMoment(r.Body)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	mc := srv.momentCache.Preview(m)
	// dateの調整
	if m.Date.IsZero() {
		img := mc.FindFirstImage()
		if img != nil {
			m.Date = img.Date_
		} else {
			m.Date = time.Now()
		}
	}
	err = srv.momentCache.Save(originalDate, m)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	mc = srv.momentCache.Fetch(m)

	dat, err := json.Marshal(struct {
		Body string `json:"body"`
		Date string `json:"date"`
		Path string `json:"path"`
	}{
		Body: mc.Content(),
		Date: mc.Moment.Date.Format(payloadTimeFormat),
		Path: mc.Moment.Path(),
	})
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	w.WriteHeader(200)
	_, err = w.Write(dat)
	if err != nil {
		log().Error(err)
	}
}

// メディアのアップロード
func (srv *Server) serveUpload(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	mimeType := r.Header.Get("Content-Type")
	if len(mimeType) == 0 {
		util.SetError(w, r, fmt.Errorf("empty Content-Type"))
		return
	}
	switch mimeType {
	case "image/jpeg", "image/png", "image/gif":
		/* Image */
		buffer, err := ioutil.ReadAll(r.Body)
		if err != nil {
			util.SetError(w, r, err)
			return
		}
		img, err := srv.shelf.AddImageEntity(mimeType, buffer)
		if err != nil {
			util.SetError(w, r, err)
			break
		}
		_, err = srv.entityCache.FetchMediumThumbnail(img)
		if err != nil {
			util.SetError(w, r, err)
			break
		}
		_, err = srv.entityCache.FetchIcon(img)
		if err != nil {
			util.SetError(w, r, err)
			break
		}
		w.WriteHeader(200)
		_, err = fmt.Fprintf(w, `[image entity="%s"]`, img.ID_)
		if err != nil {
			log().Error(err)
		}
	case "video/mp4", "video/x-matroska":
		/* Video */
		vid, err := srv.shelf.AddVideoEntity(mimeType, r.Body)
		if err != nil {
			util.SetError(w, r, err)
			break
		}
		w.WriteHeader(200)
		_, err = fmt.Fprintf(w, `[video entity="%s"]`, vid.ID_)
		if err != nil {
			log().Error(err)
		}
	default:
		w.WriteHeader(501)
		_, err := fmt.Fprintf(w, "Unknown Mime-Type: %s\n", mimeType)
		if err != nil {
			log().Error(err)
		}
	}
}
