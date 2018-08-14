package web

import (
	"net/http"

	"encoding/json"
	"io/ioutil"

	"fmt"

	"github.com/fairy-rockets/the-gear-of-seasons/shelf"
	"github.com/julienschmidt/httprouter"
)

func (srv *Server) serveAdminIndex(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.templateOf("editor/_main.html", "editor/index.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		srv.setError(w, r, err)
	}

}

func (srv *Server) serveAdminNew(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.templateOf("editor/_main.html", "editor/editor.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		srv.setError(w, r, err)
	}
}

func (srv *Server) serveAdminEdit(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.templateOf("editor/_main.html", "editor/editor.html")
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		srv.setError(w, r, err)
	}
}

func (srv *Server) serveAdminEditPreview(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	data, err := ioutil.ReadAll(r.Body)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	m := new(shelf.Moment)
	err = json.Unmarshal(data, m)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	mc := srv.momentCache.Preview(m)
	w.WriteHeader(200)
	w.Write([]byte(mc.Content()))
}

func (srv *Server) serveAdminUpload(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	buffer, err := ioutil.ReadAll(r.Body)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	mimeType := r.Header.Get("Content-Type")
	if len(mimeType) == 0 {
		srv.setError(w, r, fmt.Errorf("empty Content-Type"))
		return
	}
	switch mimeType {
	case "image/jpeg":
		fallthrough
	case "image/png":
		fallthrough
	case "image/gif":
		/* Image */
		img, err := srv.shelf.AddImageEntity(mimeType, buffer)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		_, err = srv.entityCache.FetchMedium(img)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		_, err = srv.entityCache.FetchIcon(img)
		if err != nil {
			srv.setError(w, r, err)
			break
		}
		w.WriteHeader(200)
		fmt.Fprintf(w, "[image entity=\"%s\"]", img.ID)
	case "video/mp4":
		/* Video */
		w.WriteHeader(501)
		fmt.Fprintf(w, "Not Supported yet: %s\n", mimeType)
	default:
		w.WriteHeader(501)
		fmt.Fprintf(w, "Unknown Mime-Type: %s\n", mimeType)
	}
}
