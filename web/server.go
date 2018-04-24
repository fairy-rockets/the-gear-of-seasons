package web

import (
	"html/template"
	"net/http"
	"time"

	"fmt"

	"github.com/Sirupsen/logrus"
	"github.com/julienschmidt/httprouter"
	"golang.org/x/net/context"
)

const (
	StaticPath    = "_resources/static"
	TemplatesPath = "_resources/templates"
)

type Web struct {
	impl   *http.Server
	router *httprouter.Router
}

func log() *logrus.Entry {
	return logrus.WithField("Module", "Web")
}

func NewWebServer(addr string) *Web {
	srv := &Web{}
	srv.router = httprouter.New()
	srv.impl = &http.Server{
		Addr:    addr,
		Handler: srv.router,
	}
	srv.setupRoute()
	return srv
}

func (srv *Web) setupRoute() {
	router := srv.router
	router.GET("/", srv.index)
	router.ServeFiles("/static/*filepath", http.Dir(StaticPath))
}

func (srv *Web) Start() error {
	log().Infof("Start at %s", srv.impl.Addr)
	err := srv.impl.ListenAndServe()
	if err == http.ErrServerClosed {
		err = nil
	}
	return err
}

func (srv *Web) Stop() error {
	ctx, _ := context.WithTimeout(context.Background(), time.Second*5)
	return srv.impl.Shutdown(ctx)
}

func (srv *Web) setError(w http.ResponseWriter, r *http.Request, err error) {
	w.WriteHeader(501)
	fmt.Fprintf(w, "Error:\n%v", err)
}

func (srv *Web) templateOf(files ...string) (*template.Template, error) {
	for i := range files {
		files[i] = fmt.Sprintf("%s/%s", TemplatesPath, files[i])
	}
	return template.ParseFiles(files...)
}
