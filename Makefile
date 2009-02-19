sources_js  := js/heroes-scrape.js
sources_css := css/style.css

targets_js  := $(sources_js:%.js=%.min.js)
targets_css := $(sources_css:%.css=%.min.css)

ifndef YUICOMPRESSOR
$(error YUICOMPRESSOR not defined)
endif

compress     := java -jar "$(YUICOMPRESSOR)"

all : $(targets_js) $(targets_css)

%.min.js : %.js
	$(compress) -o "$@" "$<"

%.min.css : %.css
	$(compress) -o "$@" "$<"

.PHONY : clean
clean ::
	$(RM) $(targets_js) $(targets_css)

