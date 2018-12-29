package cache

import (
	"io/ioutil"
	"net/http"

	"github.com/russross/blackfriday"
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
	html := blackfriday.MarkdownCommon(body)
	return string(html), nil
}
