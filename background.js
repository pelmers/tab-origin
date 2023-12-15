import { actionType, getActionType, actionTypeKey, TAB_ORIGIN_DATA_MSG } from '/lib.js';
import * as lib from '/lib.js';

// TODO: port to browser api
const api = chrome;

const activeTabKey = "activeTab";

/** Holds origin tab data when popup is shown.
 * Popup script requests this data when a user
 * decides to open origin tab.
 * 
 * NOTE: Assuming background script is never terminated
 * while popup is open it should be fine to hold the data
 * that way.
 */
let lastTabOriginData = {}

/** What action should be done when user clicks extension button */
let currentActionType;

// Return the last element in an array.
// If the array is empty, return null.
function last(array) {
    if (!array || array.length === 0)
        return null;
    return array[array.length - 1];
}

api.storage.local.onChanged.addListener(changes => {
    const actionType = changes[actionTypeKey]
    // looking only for "action type" changes
    if (actionType) {
        currentActionType = actionType.newValue
    }
})

/** 
 * React on extension button click and execute
 * current action (open tab, show popup, etc.)
 */
function extensionButtonClick(tab) {

    lastTabOriginData = {}

    const tabId = tab.id.toString();

    // TODO since bg script is not persistent
    // it is possible that `currentActionType` will be `undefined`
    // despite I have it set in storage, thus breaking everything.
    // As a possible solution I have to await "action type".
    // So I have to always open popup, and popup decides
    // if it should close itself
    if (currentActionType === actionType.SHOW_POPUP 
        || currentActionType === actionType.GO_TO_TAB_IF_OPEN) {
        api.action.setPopup({ popup: '/popup/popup.html' })
    }
    else {
        api.action.setPopup({ popup: '' })
    }

    api.storage.local.get(tabId)
        .then(result => {
            const result_stack = result[tabId] || [];
            const url = last(result_stack)
            if (url) {
                api.tabs.query({ url }, function (matches) {
                    
                    let originTabId = matches[0]?.id
                        , windowId = matches[0]?.windowId
                        , currentTabIndex = tab.index;
                    
                    const originTabIsOpen = matches.length > 0;
                    const tabOriginData = originTabIsOpen ? 
                        { tabId: originTabId, windowId, url } : { url, currentTabIndex, currentTabId: tab.id }

                    if (currentActionType === actionType.SHOW_POPUP) {

                        lastTabOriginData = tabOriginData
                        
                    } else if (currentActionType === actionType.GO_TO_TAB_IF_OPEN) {

                        if (originTabIsOpen) {
                            lib.focusTab(originTabId, windowId)
                        }
                        else {
                            lastTabOriginData = tabOriginData
                        }

                    } else {
                        // otherwise it is default "open tab" action

                        if (originTabIsOpen) {
                            lib.focusTab(originTabId, windowId)
                        }
                        else {
                            lib.createTab(url, currentTabIndex, result_stack)
                                .catch(err => {
                                    console.error('Cannot create tab.', err.message)
                                    api.action.setBadgeText({ text: "N/A", tabId: tab.id })
                                })
                        }
                    }
                });
            } else {
                console.log("Could not find origin for tab", tabId);
                api.action.setBadgeText({ text: "N/A", tabId: tab.id });
            }
        })

    if (currentActionType === actionType.SHOW_POPUP 
        || currentActionType === actionType.GO_TO_TAB_IF_OPEN) {
        api.action.openPopup()

        // I have to call browser.action.onClicked() every time,
        // so popup should be reset immediately because
        // onClicked() is not called with non-null popup.
        api.action.setPopup({ popup: '' })
    }
}

function updateOpenerState(newTab, openerTab) {
    const match_id = openerTab.id.toString();
    const tab_id = newTab.id.toString();
    // We set the new tab's history stack to
    // [original tab's history] + original tab's URL.
    // By retaining the entire history stack, we can do the nifty trick of
    // keeping tab origin state across repeated invocations, allowing us to tab
    // origin our way all the way back to the first tab opened.
    api.storage.local.get(match_id, function (result) {
        const match_stack = result[match_id] || [];
        // The query API does not match on hash mark, so strip that off.
        if (openerTab.url.lastIndexOf("#") > -1) {
            const base = openerTab.url.substr(0, openerTab.url.lastIndexOf("#"));
            api.storage.local.set({ [tab_id]: match_stack.concat([base]) });
        } else {
            api.storage.local.set({ [tab_id]: match_stack.concat([openerTab.url]) });
        }
    });

}

// Remark: on new tab creation, we receive onCreated before onActivated.
api.tabs.onActivated.addListener(info => {
    const id = info.tabId;
    api.storage.local.set({[activeTabKey]: id});
});

api.tabs.onCreated.addListener(function(tab) {
    if (tab.openerTabId !== undefined) {
        api.tabs.get(tab.openerTabId, function(match) {
            if (match !== undefined) {
                updateOpenerState(tab, match);
            } else {
                console.log("Opener is defined, but I can't find it for " + tab.url);
            }
        });
    } else {
        //TODO: file a bug!
        // in firefox openerTabId is not set for tabs opened by alt-enter in address bar.
        // (it's only set for tabs opened from links on the page)
        api.storage.local.get(activeTabKey, tabId => {
            api.tabs.get(tabId[activeTabKey], match => {
                if (match !== undefined) {
                    updateOpenerState(tab, match);
                } else {
                    console.log("Attempted to use active tab as opener, but it was not set.");
                }
            });
        });
    }
})

api.tabs.onRemoved.addListener(function(tabId) {
    api.storage.local.set({[tabId.toString()]: []});
});

// read initial action type
getActionType().then(type => currentActionType = type)

api.action.onClicked.addListener(extensionButtonClick);

// listen requests from popup.js 
// and send response with tab data (url, id, etc.)
api.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg[TAB_ORIGIN_DATA_MSG] !== undefined)
        sendResponse(lastTabOriginData)
})