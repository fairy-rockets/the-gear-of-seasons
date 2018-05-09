package moment

import (
	"fmt"
	"math"
	"time"
)

type Moment struct {
	Date   time.Time `yaml:"date"`
	Title  string    `yaml:"title"`
	Author string    `yaml:"author"`
	Text   string    `yaml:"text"`
}

func (m *Moment) DateString() string {
	date := m.Date
	now := time.Now()

	origin0 := time.Date(date.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())
	originA := time.Date(date.Year()-1, now.Month(), now.Day(), now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())
	originB := time.Date(date.Year()+1, now.Month(), now.Day(), now.Hour(), now.Minute(), now.Second(), now.Nanosecond(), now.Location())

	origin := origin0
	if date.Sub(originA) < origin0.Sub(date) {
		origin = originA
	}
	if originB.Sub(date) < date.Sub(origin0) {
		origin = originB
	}

	deltaYear := origin.Year() - now.Year()
	deltaDay := int(math.Round(date.Sub(origin).Hours() / 24.0))
	if deltaYear == 0 && deltaDay == 0 {
		return "今日！"
	}
	if deltaYear == 0 {
		if deltaDay > 0 {
			return fmt.Sprintf("太陽が%d回のぼった後の未来", deltaDay)
		} else {
			return fmt.Sprintf("太陽が%d回のぼる前", -deltaDay)
		}
	}

	if deltaDay == 0 {
		return fmt.Sprintf("季節の歯車を%d回まきもどした頃", -deltaYear)
	}
	if deltaDay > 0 {
		return fmt.Sprintf("季節の歯車を%d回まきもどしてから、\n太陽を%d周させたころ", -deltaYear, deltaDay)
	} else {
		return fmt.Sprintf("季節の歯車を%d回まきもどしてから、\nさらに太陽を%d周もどした頃", -deltaYear, -deltaDay)
	}
}

func (m *Moment) Path() string {
	return m.Date.Format("/2006/01/02/15:04:05/")
}
