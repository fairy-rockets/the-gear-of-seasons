package cache

import "github.com/sirupsen/logrus"

func log() *logrus.Entry {
	return logrus.WithField("Module", "Cache")
}
