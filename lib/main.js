let tabs = require("sdk/tabs"),
    tabsUtils = require("sdk/tabs/utils"),
    windows = require('sdk/windows'),
    windowUtils = require('sdk/window/utils'),
    ss = require("sdk/simple-storage"),
    prefs = require("sdk/simple-prefs"),
    { Hotkey } = require("sdk/hotkeys"), hotkey;

// XUL namespace
const xulNs = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
// Id of context menu element
const menuId = "tabOriginItem"

// Map tab id -> [history of url of active tab when it opened]
let trackedTabs = {};

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

// Open the origin url of the tab of given id. If pref is enabled, try
// switching to it first if it's already open somewhere.
function openTabOrigin(id) {
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

// Call oepnTabOrigin with the currently active tab.
function openActiveTabOrigin() {
    openTabOrigin(tabs.activeTab.id);
}

// Load the hotkey bound to the combo defined in the prefernces.
function loadHotkey() {
    if (hotkey)
        hotkey.destroy();
    hotkey = Hotkey({combo: prefs.prefs['hotkey'], onPress: openActiveTabOrigin});
}

// Iterate over all browser windows and add or remove the Tab Origin menu
// option to tabs, depending on preference status.
// If forcePref is defined as true or false, then it is taken as the value of
// the preference item, regardless of whether the preference option is actually
// ticked. Useful for forcing cleanup on uninstall, for example.
function loadContextMenus(forcePref) {
    let pref = (forcePref === true || forcePref === false)?
                    forcePref:prefs.prefs["showContextMenu"];
    for (let window of windowUtils.windows(null, {includePrivate:true})) {
        if (windowUtils.isBrowser(window)) {
            let menu = window.document.getElementById("tabContextMenu"),
                preExistingItem = window.document.getElementById(menuId);
            // Check to make sure we don't accidentally add two buttons to the
            // window tabs, and that the pref is true.
            if (!preExistingItem && pref) {
                let newMenuItem = window.document.createElementNS(xulNs, "menuitem");
                newMenuItem.setAttribute("id", menuId);
                newMenuItem.setAttribute("label", "Back to Origin Tab");
                newMenuItem.addEventListener('command', function() {
                    openTabOrigin(tabsUtils.getTabId(window.TabContextMenu.contextTab));
                });
                menu.insertBefore(newMenuItem, menu.lastChild);
            }
            // Then we know we have the item in the menu; remove it if the pref
            // is false.
            else if (preExistingItem && !pref) {
                menu.removeChild(preExistingItem);
            }
        }
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

// When a new window opens, load any tab context menus.
windows.browserWindows.on('open', loadContextMenus);

// Update the hotkey when we change the preference.
prefs.on('hotkey', loadHotkey);
// Load/destroy the context menu on preference change.
prefs.on('showContextMenu', loadContextMenus);

// Load things on startup too.
loadHotkey();
loadContextMenus();

// Clean up the tab context menus if we uninstall the addon.
exports.onUnload = loadContextMenus.bind(null, false);
