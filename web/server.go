package web

import (
	"net/http"
	"time"

	"golang.org/x/net/context"
)

type Web struct {
	impl *http.Server
	mux  *http.ServeMux
}

func NewWebServer(addr string) *Web {
	srv := &Web{}
	srv.mux = http.NewServeMux()
	srv.impl = &http.Server{
		Addr:    addr,
		Handler: srv.mux,
	}
	return srv
}

func (srv *Web) Start() error {
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
