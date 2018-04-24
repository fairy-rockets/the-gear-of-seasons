#! /bin/bash

cat > ${GOFILE%.go}.gen.go <<END
package ${GOPACKAGE}

import (
	"encoding/base64"
	"fmt"
	"strings"
)

func buildAt() string {
	return "$(date -u "+%Y/%m/%d %H:%M:%S")"
}

func gitRev() string {
	data, err := base64.StdEncoding.DecodeString("$(git log -1 | base64 | tr -d '[:space:]')")
	if err != nil {
		return fmt.Sprintf("<an error occured while reading git rev: %v>", err)
	}
	if len(data) == 0 {
		return "<not available>"
	}
	return strings.TrimSpace(string(data))
}

END