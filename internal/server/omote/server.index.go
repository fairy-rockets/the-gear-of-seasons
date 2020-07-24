package omote

import (
	"net/http"

	"github.com/fairy-rockets/the-gear-of-seasons/internal/server/util"
	"github.com/julienschmidt/httprouter"
)

func (srv *Server) serveIndex(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	var err error
	t, err := srv.templateGen.Parse("index.html").Bulld()
	if err != nil {
		util.SetError(w, r, err)
		return
	}
	err = t.Execute(w, nil)
	if err != nil {
		util.SetError(w, r, err)
	}
}
