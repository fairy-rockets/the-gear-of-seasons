package web

import (
	"io"
	"net/http"
	"os"

	"github.com/julienschmidt/httprouter"
)

func (srv *Web) serveEntity(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.entities.Lookup(id)
	if e == nil {
		w.WriteHeader(404)
		w.Write([]byte("Not found."))
		return
	}
	f, err := os.Open(e.GetPath())
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	defer f.Close()
	w.WriteHeader(200)
	w.Header().Add("Content-Type", e.GetMimeType())
	io.Copy(w, f)
}

func (srv *Web) serveEntityThumbnail(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.entities.Lookup(id)
	if e == nil {
		w.WriteHeader(404)
		w.Write([]byte("Not found."))
		return
	}
	path, err := srv.entityCache.FetchThumbnail(e)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	f, err := os.Open(path)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	defer f.Close()
	w.WriteHeader(200)
	w.Header().Add("Content-Type", "image/jpeg")
	io.Copy(w, f)
}
