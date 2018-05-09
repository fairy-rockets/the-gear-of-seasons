package web

import (
	"net/http"

	"encoding/json"
	"io/ioutil"

	"github.com/FairyRockets/the-gear-of-seasons/shelf/moment"
	"github.com/julienschmidt/httprouter"
)

func (srv *Server) serveAdminIndex(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.templateOf("admin/_main.html", "admin/index.html")
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
	t, err := srv.templateOf("admin/_main.html", "admin/editor.html")
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
	t, err := srv.templateOf("admin/_main.html", "admin/editor.html")
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
	m := new(moment.Moment)
	err = json.Unmarshal(data, m)
	if err != nil {
		srv.setError(w, r, err)
		return
	}
	mc := srv.momentCache.Preview(m)
	w.WriteHeader(200)
	w.Write([]byte(mc.Body))
}
