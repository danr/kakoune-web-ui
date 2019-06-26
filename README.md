# neptyne
​
[![IRC][IRC Badge]][IRC]

Editor-agnostic jupyter kernel interaction and [kakoune](http://kakoune.org) integration

Work in progress. Enjoy your tinkering around.

## Setup using kakoune

Clone this repo somewhere and make sure kakoune sources it.

You will need:
* jupyter the python lib
* ipython (or ijulia)
* inotify
* xterm
* optional: jedi
* optional: libsixel for images
* optional: imagemagick for svg

## Usage from kakoune

Run the command `neptyne`, it will spawn an xterm for you.

The file `neptyne.kak` defines a few keybindings, most of them in insert mode.

Note that the virtualenv you start kakoune in will be inherited from the xterm that is spawned.

## Usage without kakoune

Run `python /path/to/neptyne/neptyne.py your_file.py`.

## License

MIT

[IRC]: https://webchat.freenode.net?channels=kakoune
[IRC Badge]: https://img.shields.io/badge/IRC-%23kakoune-blue.svg
