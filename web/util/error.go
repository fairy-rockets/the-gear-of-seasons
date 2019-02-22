package util

import (
	"fmt"
	"net/http"
)

func SetError(w http.ResponseWriter, _ *http.Request, err error) {
	w.WriteHeader(503)
	http.Error(w, fmt.Sprintf("[Error] %v", err), http.StatusInternalServerError)
}
