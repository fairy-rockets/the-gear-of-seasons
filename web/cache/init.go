package cache

import "github.com/Sirupsen/logrus"

func log() *logrus.Entry {
	return logrus.WithField("Module", "Cache")
}
