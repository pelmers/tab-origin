var tabs = require("sdk/tabs"),
    ss = require("sdk/simple-storage"),
    prefs = require("sdk/simple-prefs"),
    { Hotkey } = require("sdk/hotkeys"), hotkey,
    cm = require("sdk/context-menu"), cmItem;

// Map tab id -> [history of url of active tab when it opened]
var trackedTabs = {};

// Return the last element in an array.
// If the array is empty, return null.
function last(array) {
    if (!array || array.length === 0)
        return null;
    return array[array.length - 1];
}

// Iterate over the tabs and return the first one where condition(tab) is true.
// If no tab is found, return null.
function findTab(condition) {
    for (let tab of tabs)
        if (condition(tab))
            return tab;
    return null;
}

// Open the origin url of the currently active tab. If pref is enabled, try
// switching to it first if it's already open somewhere.
function openActiveTabOrigin() {
    let id = tabs.activeTab.id;
    if (last(trackedTabs[id])) {
        // First try to find a tab with this url and switch to it. (if pref enabled)
        if (prefs.prefs['switchIfPossible']) {
            let switchTo = findTab(function(tab) {
                return tab.url === last(trackedTabs[id]);
            });
            if (switchTo) {
                switchTo.activate();
                return;
            }
        }
        // Nothing found, open a new tab.
        tabs.open({
            url: last(trackedTabs[id]),
            onReady: function(tab) {
                // We don't want to set the last tab to the one we just came
                // from (this one), instead we want to inherit the parent tab
                // stack so we can keep going all the way back.
                trackedTabs[tab.id] = trackedTabs[id].slice(0, -1);
            }
        });
    } else {
        console.log("Could not find origin for tab", id);
    }
}

function loadHotkey() {
    if (hotkey)
        hotkey.destroy();
    hotkey = Hotkey({combo: prefs.prefs['hotkey'], onPress: openActiveTabOrigin});
}

function loadContextMenu() {
    if (cmItem)
        cmItem.destroy();
    if (prefs.prefs["showContextMenu"]) {
        cmItem = cm.Item({
            label: "Back to origin tab",
            contentScript: 'self.on("click", function() { self.postMessage() })',
            onMessage: openActiveTabOrigin
        });
    }
}

// Track the url from which we opened this tab.
tabs.on('open', function(tab) {
    // We set the new tab's history stack to
    // [original tab's history] + original tab's URL.
    // By retaining the entire history stack, we can do the nifty trick of
    // keeping tab origin state across repeated invocations, allowing us to tab
    // origin our way all the way back to the first tab opened.
    trackedTabs[tabs.activeTab.id] = trackedTabs[tabs.activeTab.id] || [];
    trackedTabs[tab.id] = trackedTabs[tabs.activeTab.id].concat([tabs.activeTab.url]);
});

// Update the hotkey when we change the preference.
prefs.on('hotkey', loadHotkey);
// Load/destroy the context menu on preference change.
prefs.on('showContextMenu', loadContextMenu);
// Load things on startup too.
loadHotkey();
loadContextMenu();

