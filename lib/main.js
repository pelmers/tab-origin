var tabs = require("sdk/tabs"),
    ss = require("sdk/simple-storage"),
    prefs = require("sdk/simple-prefs"),
    { Hotkey } = require("sdk/hotkeys"), hotkey;

 // Map tab id -> url of active tab when it opened
ss.storage.trackedTabs = ss.storage.trackedTabs || {};
// Alias to make referencing easier.
var trackedTabs = ss.storage.trackedTabs;

function loadHotkey() {
    if (hotkey)
        hotkey.destroy();
    hotkey = Hotkey({combo: prefs.prefs['hotkey'], onPress: openActiveTabOrigin});
}
loadHotkey();

function openActiveTabOrigin() {
    var id = tabs.activeTab.id;
    if (trackedTabs[id] !== undefined)
        tabs.open(trackedTabs[id]);
    else
        console.log("Could not find origin for tab", id);
}

// Track the url from which we opened this tab.
tabs.on('open', function(tab) { trackedTabs[tab.id] = tabs.activeTab.url; });

// Update the hotkey when we change the preference.
prefs.on('hotkey', loadHotkey);

