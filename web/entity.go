package web

import (
	"io"
	"net/http"
	"os"

	"github.com/julienschmidt/httprouter"
)

func (srv *Server) serveEntity(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.shelf.LookupEntity(id)
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

func (srv *Server) serveEntityMedium(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.shelf.LookupEntity(id)
	if e == nil {
		w.WriteHeader(404)
		w.Write([]byte("Not found."))
		return
	}
	path, err := srv.entityCache.FetchMedium(e)
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

func (srv *Server) serveEntityIcon(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.shelf.LookupEntity(id)
	if e == nil {
		w.WriteHeader(404)
		w.Write([]byte("Not found."))
		return
	}
	path, err := srv.entityCache.FetchIcon(e)
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
