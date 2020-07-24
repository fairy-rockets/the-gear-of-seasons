package cache

import (
	"io/ioutil"
	"net/http"

	"gopkg.in/russross/blackfriday.v2"
)

func fetchMarkdown(url string) (string, error) {
	var err error
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	html := blackfriday.Run(body)
	return string(html), nil
}
