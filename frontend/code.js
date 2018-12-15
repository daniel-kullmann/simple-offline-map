var map = null;
var tileLayer = null;
var gpx_files = [];

var colors = [
    ['red', 0],
    ['blue', 0],
    ['green', 0]
];

function bound_map_by_gpx_tracks() {
    if (gpx_files.length > 0) {
        var all_bounds = gpx_files.map(function(item) { return item.bounds; });
        var super_bounds = all_bounds.reduce(function(a,b) {return a.extend(b);});
        map.fitBounds(super_bounds);
    }
}

function drop_color(color) {
    for (var i=0; i<colors.length; i++) {
        if (colors[i][0] == color) {
            colors[i][1]--;
        }
    }
}

function pick_color() {
    var lowest = 0;
    for (var i=1; i<colors.length; i++) {
        if (colors[i][1] < colors[lowest][1]) {
            lowest = i;
        }
    }
    colors[lowest][1]++;
    return colors[lowest][0];
}

var track_in_creation = null;

function mouse_click_handler(event) {
    track_in_creation.points.push(event.latlng);
    var number = track_in_creation.points.length;
    if (number > 1) {
        track_in_creation.distance += map.distance(
            track_in_creation.points[number-1],
            track_in_creation.points[number-2]
        );
        $("#track-in-creation-distance").text(track_in_creation.distance.toFixed(2) + "m");
    }
    if (track_in_creation.poly_line) {
        track_in_creation.poly_line.remove();
    }
    track_in_creation.poly_line = L.polyline(track_in_creation.points, {color: 'black'});
    track_in_creation.poly_line.addTo(map);
}

function start_track_creation() {
    track_in_creation = {
        name: "unnamed track",
        points: [],
        poly_line: null,
        distance: 0
    };
    $("#start-track-creation").css("display", "none");
    $("#stop-track-creation").css("display", "inline");
    $('[name="track-in-creation-name"]').css("display", "inline");
    $('[name="track-in-creation-name"]').attr("value", track_in_creation.name);
    $("#track-in-creation-distance").css("display", "inline");
    $("#track-in-creation-distance").text(track_in_creation.distance.toFixed(2) + "m");
    map.on("click", mouse_click_handler);
}

function stop_track_creation() {
    $("#start-track-creation").css("display", "inline");
    $("#stop-track-creation").css("display", "none");
    $('[name="track-in-creation-name"]').css("display", "none");
    $("#track-in-creation-distance").css("display", "none");
    map.off("click", mouse_click_handler);
    if (track_in_creation.poly_line) {
        track_in_creation.poly_line.remove();
    }
    console.log(track_in_creation);
    var track_points = track_in_creation.points.map(function(p) { return [p.lat, p.lng]; });
    var gpx_data = {
        name: track_in_creation.name,
        date: new Date().toISOString(), // TODO
        description: '', // TODO
        track_points: track_points,
    };
    save_gpx(gpx_data);
    track_in_creation = null;
}

function save_gpx(gpx_data) {
    $.ajax({
        type: 'GET',
        url: '/api/settings/token/',
        success: function(data, textStatus, request) {
            $.ajax({
                type: 'POST',
                url: '/api/gpx/save/',
                data: JSON.stringify(gpx_data),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'X-CSRFToken': data.token
                },
                success: function(data, textStatus, request) {
                    // ignore
                },
                error: function(request, textStatus, error) {
                    $("#error-message").text(error);
                },
                dataType: 'json'
            });
        },
        error: function(request, textStatus, error) {
            $("#error-message").text(error);
        },
        dataType: 'json'
    });
}


var lat_min, lat_max, lon_min, lon_max, lat, lon, zoom;
var zoom_min = 8;
var zoom_max = 16;

var map_scan_id = null;
function map_scan() {
    map.setView(L.latLng(lat, lon), zoom);
    var bounds = map.getBounds();
    var width = 0.95*Math.abs(bounds.getWest() - bounds.getEast());
    var height = 0.95*Math.abs(bounds.getNorth() - bounds.getSouth());
    var msg = "random walk to: " + lat.toFixed(3) + ", " + lon.toFixed(3) + ", " + zoom;
    $("#map-scan-info").text(msg);
    if (lat >= lat_max) {
        lat = lat_min;
        if (lon >= lon_max) {
            lon = lon_min;
            if (zoom == zoom_max) {
                toggle_map_scan(false);
            } else {
                zoom += 1;
            }
        } else {
            lon += width;
        }
    } else {
        lat += height;
    }
}
function toggle_map_scan(enable) {
    if (enable) {
        var bounds = map.getBounds();
        lat_min = Math.min(bounds.getSouth(), bounds.getNorth());
        lat_max = Math.max(bounds.getSouth(), bounds.getNorth());
        lon_min = Math.max(bounds.getEast(), bounds.getWest());
        lon_max = Math.max(bounds.getEast(), bounds.getWest());
        lat = lat_min;
        lon = lon_min;
        zoom = zoom_min;
        map_scan_id = setInterval(map_scan, 4000);
        map_scan();
    } else {
        clearInterval(map_scan_id);
        $("#map-scan-info").text("");
    }
}


function show_gpx_file(show, file) {
    if (show) {
        $.ajax({
            type: 'GET',
            url: '/api/gpx/get/' + file,
            //data: {...},
            success: function(data, textStatus, request) {
                var color = pick_color();
                var points = data.getElementsByTagName('trkpt');
                var markers = [];
                var line_coordinates = [];
                var distance = 0;
                var lastLatLon = null;
                for (var i=0; i<points.length; i++) {
                    var attr = points.item(i).attributes;
                    var lat = attr.getNamedItem("lat").value;
                    var lon = attr.getNamedItem("lon").value;

                    line_coordinates.push([lat,lon]);
                    if (i==0 || i == points.length-1) {
                        var r = L.marker([lat, lon]).addTo(map);
                        markers.push(r);
                    }
                    var latLon = L.latLng(lat, lon);
                    if (i>0) {
                        distance += map.distance(lastLatLon, latLon);
                    }
                    lastLatLon = latLon;
                }
                var poly_line = L.polyline(line_coordinates, {color: color});
                poly_line.addTo(map);
                gpx_files.push({
                    file: file,
                    markers: markers,
                    poly_line: poly_line,
                    distance: distance,
                    bounds: poly_line.getBounds()
                });
                $('[name="track-'+file+'"]').text("(" + distance.toFixed(3) + "m)");
            },
            error: function(request, textStatus, error) {
                $("#error-message").text(error);
                //showError('Oops, there was a problem retrieving the comments.');
            },
            dataType: 'xml'
        });
    } else {
        var gpx_file = gpx_files.find(function (item) { return item.file == file; });
        if (gpx_file) {
            if (gpx_file.markers) {
                gpx_file.markers.forEach(function(item) {
                    item.remove();
                });
            }
            if (gpx_file.poly_line) {
                gpx_file.poly_line.remove();
            }
            gpx_files = gpx_files.filter(function (item) { return item.file != file; });
        }
    }
}

function load_gpx_track_list() {
    $.ajax({
        type: 'GET',
        url: '/api/gpx/',
        //data: {...},
        success: function(data, textStatus, request) {
            var text = "<ul>";
            data.forEach(function(track) {
                text += "<li>";
                text += "<input type=\"checkbox\" ";
                text += "onClick=\"show_gpx_file(this.checked,'" + track + "');\"";
                if (gpx_files.find(function (f) { return f.file == track })) {
                    text += " checked";
                }
                text += "/>";
                text += track;
                text += "&nbsp;<span name=\"track-"+ track + "\"/>";
                text += "</li>";
            });
            text += "</ul>";
            $("#gpx-list").html(text);
        },
        error: function(request, textStatus, error) {
            $("#error-message").text(error);
            //showError('Oops, there was a problem retrieving the comments.');
        },
        dataType: 'json'
    });
}

function mouse_has_moved(event) {
    var msg = "Mouse: " + event.latlng.lat.toFixed(3) + ", " + event.latlng.lng.toFixed(3);
    $("#location-info").text(msg);
}

/** Used in save_map_view_soon. */
var save_map_view_id = null;
var save_map_view_start = null;
function save_map_view(bounds) {
    $.ajax({
        type: 'GET',
        url: '/api/settings/token/',
        success: function(data, textStatus, request) {
            var latitude = (bounds.getNorth() + bounds.getSouth()) / 2;
            var longitude = (bounds.getWest() + bounds.getEast()) / 2;
            var settings = {
                latitude: latitude,
                longitude: longitude,
                zoom: map.getZoom(),
                csrfmiddlewaretoken: data.token,
            };
            $.ajax({
                type: 'POST',
                url: '/api/settings/set_all_settings/',
                data: settings,
                success: function(data, textStatus, request) {
                    // The id is not needed anymore, because the setTimeout has fired.
                    save_map_view_id = null;
                    save_map_view_start = null;
                },
                error: function(request, textStatus, error) {
                    $("#error-message").text(error);
                    //showError('Oops, there was a problem retrieving the comments.');
                },
                dataType: 'json'
            });
        },
        error: function(request, textStatus, error) {
            $("#error-message").text(error);
            //showError('Oops, there was a problem retrieving the comments.');
        },
        dataType: 'json'
    });
}

/** Saves the map view (latitude, longitude, zoom) sometime in the future.
    The reason for this function is that I don't want the web site to store the
    map view too often. If you scroll lazily around the map, the map view can
    change several times per second. I don't want to save the map view that
    often to reduce load on the server. So I setup a timeout to save the view.
    If another map move or zoom event comes in the meantime, I cancel the
    timeout and setup another.
    TODO: If you scroll around a lot, and then close the website very fast,
    The map view won't be saved at all. Maybe I want to keep track of canceled
    timeouts, and then save anyway if e.g. I haven't saved for 2 seconds or so.
*/
function save_map_view_soon(bounds) {
    if (save_map_view_id != null) {
        var now = new Date().getTime();
        if (save_map_view_start === null || (now - save_map_view_start) < 2000) {
            clearTimeout(save_map_view_id);
            save_map_view_id = null;
        }
    } else {
        save_map_view_start = new Date().getTime();
    }
    if (save_map_view_id == null) {
        save_map_view_id = setTimeout(save_map_view.bind(null, bounds), 2000);
    }
}

function map_info_has_changed(event) {
    var bounds = map.getBounds();
    var msg = bounds.getNorth().toFixed(2) + ", " + bounds.getWest().toFixed(2) +
        " => " + bounds.getSouth().toFixed(2) + ", " + bounds.getEast().toFixed(2) +
        "<br/>Zoom " + map.getZoom().toFixed(0);
    $("#map-info").html(msg);
    save_map_view_soon(bounds);
}

function load_content_if_necessary(event) {
    if (event.id == 'settings') {
        restore_settings(false);
    }
}

function save_settings()  {
    var settings = {
        base_tile_url: get_settings_form_element('base_tile_url').value
    };

    $.ajax({
        type: 'GET',
        url: '/api/settings/token/',
        success: function(data, textStatus, request) {
            settings.csrfmiddlewaretoken = data.token;
            $.ajax({
                type: 'POST',
                url: '/api/settings/set_all_settings/',
                data: settings,
                success: function(data, textStatus, request) {
                    // ignore
                },
                error: function(request, textStatus, error) {
                    $("#error-message").text(error);
                    //showError('Oops, there was a problem retrieving the comments.');
                },
                dataType: 'json'
            });
        },
        error: function(request, textStatus, error) {
            $("#error-message").text(error);
            //showError('Oops, there was a problem retrieving the comments.');
        },
        dataType: 'json'
    });

    tileLayer.setUrl(settings.base_tile_url);
}

function restore_settings(set_map_bounds) {
    $.ajax({
        type: 'GET',
        url: '/api/settings/',
        //data: {...},
        success: function(data, textStatus, request) {
            if (!data.base_tile_url) {
                data.base_tile_url = tileLayer._url;
                if (!data.base_tile_url) {
                    data.base_tile_url = '';
                }
            }
            get_settings_form_element('base_tile_url').value = data.base_tile_url;
            tileLayer.setUrl(data.base_tile_url);
            if (set_map_bounds) {
                if (data.latitude !== undefined && data.longitude !== undefined && data.zoom !== undefined) {
                    map.setView(L.latLng(data.latitude, data.longitude), data.zoom);
                } else {
                    map.setView([37.31915, -8.8033], 13);
                }
            }
        },
        error: function(request, textStatus, error) {
            $("#error-message").text(error);
            //showError('Oops, there was a problem retrieving the comments.');
        },
        dataType: 'json'
    });
}

function tile_error(event) {
    var msg = "tile error: " + event.coords.x + ", " + event.coords.y;
    $("#error-message").text(msg);
}

function get_settings_form_element(name)  {
    var form = $('form[name="settings"]')[0];
    for (var i=0; i<form.length; i++) {
        if (form[i].name == name) {
            return form[i];
        }
    }
}

function choose_osm_as_tiles_url() {
    var element = get_settings_form_element('base_tile_url');
    element.value='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

function choose_localhost_8000_as_tiles_url() {
    var element = get_settings_form_element('base_tile_url');
    element.value='http://localhost:8000/api/tiles/{s}/{z}/{x}/{y}.png';
}

function choose_django_server_as_tiles_url() {
    var element = get_settings_form_element('base_tile_url');
    element.value='/api/tiles/{s}/{z}/{x}/{y}.png';
}

function choose_node_server_as_tiles_url() {
    var element = get_settings_form_element('base_tile_url');
    element.value='/tile-server/{s}/{z}/{x}/{y}.png';
}


$(document).ready(function() {

    map = L.map('map');

    tileLayer = L.tileLayer('/api/tiles/{s}/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	      crossOrigin: true
    });
    tileLayer.addTo(map);

    var sidebar = L.control.sidebar('sidebar').addTo(map);

    map.on('mousemove', mouse_has_moved);
    map.on('zoom', map_info_has_changed);
    map.on('move', map_info_has_changed);
    map.on('tileerror', tile_error);
    sidebar.on('content', load_content_if_necessary);

    restore_settings(true);
    load_gpx_track_list();

    $('[name="zoom_min"]').text(zoom_min);
    $('[name="zoom_max"]').text(zoom_max);

});
