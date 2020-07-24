package ura

import (
	"net/http"
	"os"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/server/util"
	"github.com/julienschmidt/httprouter"
)

func (srv *Server) serveEntity(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	var err error
	id := p.ByName("id")
	e := srv.shelf.LookupEntity(id)
	if e == nil {
		w.WriteHeader(404)
		_, _ = w.Write([]byte("Not found."))
		return
	}
	_, err = os.Stat(e.SystemPath())
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	http.ServeFile(w, r, e.SystemPath())
}

func (srv *Server) serveEntityMedium(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.shelf.LookupEntity(id)
	if e == nil {
		w.WriteHeader(404)
		_, _ = w.Write([]byte("Not found."))
		return
	}
	path, err := srv.entityCache.FetchMediumThumbnail(e)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	_, err = os.Stat(path)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	http.ServeFile(w, r, path)
}

func (srv *Server) serveEntityIcon(w http.ResponseWriter, r *http.Request, p httprouter.Params) {
	id := p.ByName("id")
	e := srv.shelf.LookupEntity(id)
	if e == nil {
		w.WriteHeader(404)
		_, _ = w.Write([]byte("Not found."))
		return
	}
	path, err := srv.entityCache.FetchIcon(e)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	_, err = os.Stat(path)
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	http.ServeFile(w, r, path)
}
