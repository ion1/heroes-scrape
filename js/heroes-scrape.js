(function ($) {

function debug (text) {
  $('<div/>').prependTo ($('#content')).text (text);
}

function HeroesScrapeError (message) {
  this.name = 'HeroesScrapeError';
  this.message = message;
}

HeroesScrapeError.prototype.toString = function () {
  return this.name + ': ' + this.message;
}

function pad (num, len) {
  var res = '' + num;

  while (res.length < len) {
    res = '0' + res;
  }

  return res;
}

// Progress indicator.
$(function () {
  $('body')
    .ajaxStart (function () { $(this).css ('cursor', 'progress'); })
    .ajaxStop  (function () { $(this).css ('cursor', null);       });

  $('<div id="loading-indicator">Loading...</div>')
    .css ({
      'position':    'absolute',
      'top':         0,
      'right':       0,
      'background':  'yellow',
      'color':       'black',
      'font-weight': 'bold',
    })
    .hide ()
    .prependTo ($('body'))
    .ajaxStart (function () { $(this).show (); })
    .ajaxStop  (function () { $(this).hide (); });
});

// The scraping.

function get_wikipedia_page (title, callback) {
  var uri = 'http://en.wikipedia.org/w/api.php?action=parse&page='
            + title + '&prop=text&format=json&callback=?'

  $.getJSON (uri, function (data) {
    var tree = $('<div/>').html (data.parse.text['*'])[0];
    callback (tree);
  });
}

var scraped_episodes = false,
    scraped_comics   = false,
    list             = [];

function add_episode (season, episode, title, wp_uri, date) {
  if (typeof season != 'number'
      || typeof episode != 'number'
      || typeof title != 'string'
      || typeof wp_uri != 'string'
      || typeof date != 'string'
      || ! /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.exec (date)) {
    throw new HeroesScrapeError ('add_episode: Invalid parameters');
  }

  list.push ({
    type:    'episode',
    season:  season,
    episode: episode,
    id:      '' + season + 'x' + pad (episode, 2),
    title:   title,
    wp_uri:  wp_uri,
    date:    date,
  });
}

function add_comic (id, title, uri, date) {
  if (typeof id != 'number'
      || typeof title != 'string'
      || typeof uri != 'string'
      || typeof date != 'string'
      || ! /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.exec (date)) {
    throw new HeroesScrapeError ('add_comic: Invalid parameters');
  }

  list.push ({
    type:  'comic',
    id:    id,
    title: title,
    uri:   uri,
    date:  date,
  });
}

function sort_list () {
  list.sort (function (a, b) {
    if (a.date != b.date) {
      return (a.date < b.date) ? -1 : 1;

    } else if (a.type != b.type) {
      return (a.type == 'episode') ? -1 : 1;

    } else if (a.id != b.id) {
      return (a.id < b.id) ? -1 : 1;

    } else {
      return 0;
    }
  });

  list.reverse ();
}

function now () {
  var date = new Date;

  return pad (date.getFullYear (), 4)
    + '-' + pad (date.getMonth () + 1, 2)
    + '-' + pad (date.getDate (), 2)
}

function generate_table () {
  if (! scraped_episodes || ! scraped_comics) {
    return;
  }

  sort_list ();

  var today = now ();

  var table = $('<table id="heroes-table"/>'),
      thead = $('<thead/>').appendTo (table),
      tbody = $('<tbody/>').appendTo (table);

  $('<tr/>')
    .appendTo (thead)
    .append ($('<th class="date">Date</th>'))
    .append ($('<th class="type">Type</th>'))
    .append ($('<th class="id">ID</th>'))
    .append ($('<th class="title">Title</th>'))
    .append ($('<th class="misc"> </th>'))

  $.each (list, function () {
    var tr = $('<tr/>').appendTo (tbody);

    if (this.date == today) {
      tr.addClass ('today');
    } else if (this.date > today) {
      tr.addClass ('upcoming');
    }

    tr.addClass (this.type);

    var td_date  = $('<td class="date"/>').appendTo (tr),
        td_type  = $('<td class="type"/>').appendTo (tr),
        td_id    = $('<td class="id"/>').appendTo (tr),
        td_title = $('<td class="title"/>').appendTo (tr),
        td_misc  = $('<td class="misc"/>').appendTo (tr);

    td_date.text (this.date);

    $('<img/>')
      .attr ({
        'src':   'img/' + this.type + '.png',
        'alt':   this.type,
        'title': this.type,
        'class': 'icon',
      })
      .appendTo (td_type);

    td_id.text (this.id);

    if (this.uri) {
      $('<a/>')
        .text (this.title)
        .attr ('href', this.uri)
        .appendTo (td_title);

    } else {
      td_title.text (this.title);
    }

    if (this.wp_uri) {
      $('<a/>')
        .attr ('href', this.wp_uri)
        .append (
          $('<img/>')
            .attr ({
              'src':   'img/wikipedia.png',
              'alt':   'Wikipedia',
              'title': '“' + this.title + '” in Wikipedia',
              'class': 'icon',
            })
        )
        .appendTo (td_misc);
    }
  });

  $('#heroes-table-container')
    .empty ()
    .append (table);
}

var month_map = {
  january:    1,
  february:   2,
  march:      3,
  april:      4,
  may:        5,
  june:       6,
  july:       7,
  august:     8,
  september:  9,
  october:   10,
  november:  11,
  december:  12,
};

function parse_date (string) {
  var m = /^(\S+) ([0-9]+), ([0-9]+)/.exec (string);

  if (! m || ! month_map[m[1].toLowerCase ()]) {
    throw new HeroesScrapeError ('parse_date: Invalid parameters');
  }

  var year  = + m[3],
      month = month_map[m[1].toLowerCase ()],
      day   = + m[2];

  return pad (year, 4) + '-' + pad (month, 2) + '-' + pad (day, 2);
}

function scrape_episodes (tree) {
  $(tree).find ('h3').each (function () {
    var text = $(this).find ('.mw-headline').text (),
        m    = /^Season ([0-9]+)/.exec (text);

    if (m) {
      var season = + m[1];

      // The first episode of a season.
      var first_ep = null;

      $(this).next ('table').find ('tr').each (function () {
        var ep = $(this).find ('td:eq(0)').text ();

        if (/^[0-9]+$/.exec (ep)) {
          ep = + ep;
          if (first_ep === null) {
            first_ep = ep;
          }

          var ep_real = 1 + ep - first_ep,
              title   = $(this).find ('td:eq(1) b').text (),
              wp_uri  = 'http://en.wikipedia.org'
                        + $(this).find ('td:eq(1) b a').attr ('href');
              date    = parse_date ($(this).find ('td:eq(5)').text ());

          add_episode (season, ep_real, title, wp_uri, date);
        }
      });
    }
  });

  scraped_episodes = true;
  generate_table ();
}

function scrape_comics (tree) {
  $(tree).find ('table tr').each (function () {
    var id = $(this).find ('td:eq(0)').text ();

    if (/^[0-9]+$/.exec (id)) {
      id = + id;

      var title = $(this).find ('td:eq(1) a:first').text (),
          uri   = $(this).find ('td:eq(1) a:first').attr ('href'),
          date  = $(this).find ('td:eq(2)').text ();

      add_comic (id, title, uri, date);
    }
  });

  scraped_comics = true;
  generate_table ();
}

$(function () {
  $('#heroes-table-container').text ('Loading...');

  get_wikipedia_page ('List_of_Heroes_episodes',       scrape_episodes);
  get_wikipedia_page ('List_of_Heroes_graphic_novels', scrape_comics);
});

}) (jQuery);

// vim:set et sw=2 sts=2:
