package cache

import (
	"fmt"
	"regexp"
	"sync"

	"strings"

	"github.com/FairyRockets/the-gear-of-seasons/shelf"
)

type MomentCache struct {
	shelf   *shelf.Shelf
	mutex   sync.Mutex
	entries map[*shelf.Moment]*Moment
}

func NewMomentCache(sh *shelf.Shelf) *MomentCache {
	return &MomentCache{
		shelf:   sh,
		entries: make(map[*shelf.Moment]*Moment),
	}
}

type Moment struct {
	Body   string
	Embeds []shelf.Entity
}

var (
	embedRegex     = regexp.MustCompile(`\[(link|image|video|audio) ([^\]]+)\]`)
	paragraphRegex = regexp.MustCompile(`((\r?\n){2})`)
	blockRegex     = regexp.MustCompile(`<(script|div|pre|hr|ol|ul|video|blockquote|canvas) `)
	keyValueRegex  = regexp.MustCompile(`([a-z]+)="([^"]*)"`)
)

func parseEmbedFiels(str string) map[string]string {
	kv := make(map[string]string)
	for _, matches := range keyValueRegex.FindAllStringSubmatch(str, -1) {
		kv[matches[1]] = matches[2]
	}
	return kv
}
func (mc *MomentCache) lookup(m *shelf.Moment) (*Moment, bool) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	entry, ok := mc.entries[m]
	return entry, ok
}

func (mc *MomentCache) set(m *shelf.Moment, entry *Moment) {
	mc.mutex.Lock()
	defer mc.mutex.Unlock()
	mc.entries[m] = entry
}

func (mc *MomentCache) Fetch(m *shelf.Moment) *Moment {
	if cached, ok := mc.lookup(m); ok {
		return cached
	}
	cached := mc.compile(m)
	mc.set(m, cached)
	return cached
}

func (mc *MomentCache) Preview(m *shelf.Moment) *Moment {
	return mc.compile(m)
}

func (mc *MomentCache) compile(m *shelf.Moment) *Moment {
	embeds := make([]shelf.Entity, 0)

	paragraphs := paragraphRegex.Split(m.Text, -1)

	for i, paragraph := range paragraphs {

		if embedRegex.MatchString(paragraph) || blockRegex.MatchString(paragraph) {
			continue
		}
		paragraphs[i] = fmt.Sprintf("<p>%s</p>", paragraph)
	}

	body := strings.Join(paragraphs, "\n")

	body = embedRegex.ReplaceAllStringFunc(body, func(embed string) string {
		matches := embedRegex.FindStringSubmatch(embed)
		fileType := matches[1]
		fields := parseEmbedFiels(matches[2])
		id, ok := fields["entity"]
		if !ok {
			return fmt.Sprintf(`<strong class="error">No entity field</strong>`)
		}
		e := mc.shelf.LookupEntity(id)
		if e == nil {
			return fmt.Sprintf(`<strong class="error">Entity(%s) not found</strong>`, id)
		}
		switch fileType {
		case "link":
			url := fmt.Sprintf("/entity/%s", id)
			text := url
			if v, ok := fields["text"]; ok {
				text = v
			}
			return fmt.Sprintf(`<a href="%s">%s</a>`, url, text)
		case "image":
			if img, ok := e.(*shelf.ImageEntity); ok {
				embeds = append(embeds, e)
				url := fmt.Sprintf("/entity/%s", id)
				src := fmt.Sprintf("/entity/%s/medium", id)
				if v, ok := fields["to"]; ok {
					url = v
				}
				w, h := calcImageSizeWithMinLength(uint(img.Width), uint(img.Height), MediumSize)
				return fmt.Sprintf(`<a href="%s"><img src="%s" class="embed" width="%d" height="%d"></a>`, url, src, w, h)
			} else {
				return fmt.Sprintf(`<strong class="error">Entity(%s) is not image.</strong>`, id)
			}
		case "video":
			if video, ok := e.(*shelf.VideoEntity); ok {
				embeds = append(embeds, e)
				url := fmt.Sprintf("/entity/%s", id)
				return fmt.Sprintf(`<video  width="%d" height="%d" preload="metadata" controls="controls"><source type="%s" src="%s" /><a href="%s">Click to play.</a></video>`, video.Width, video.Height, video.MimeType, url, url)
			} else {
				return fmt.Sprintf(`<strong class="error">Entity(%s) is not video.</strong>`, id)
			}
		case "audio":
			return fmt.Sprintf(`<strong class="error">%s not supported</strong>`, fileType)
		default:
			return fmt.Sprintf(`<strong class="error">%s not supported</strong>`, fileType)
		}
	})
	compiledBody := fmt.Sprintf(`
<div class="moment-info">
	<h1 class="moment-title">%s</h1>
	<span class="moment-date">%s</span>
	<span class="moment-author">%s</span>
</div>
<hr>
%s`, m.Title, m.DateString(), m.Author, body)
	return &Moment{
		Embeds: embeds,
		Body:   compiledBody,
	}

}
