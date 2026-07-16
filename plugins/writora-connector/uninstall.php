<?php
/**
 * Uninstall cleanup for Writora Connector.
 *
 * Runs when the plugin is DELETED from the Plugins screen (not on deactivate).
 * Removes the connection token and the per-post Writora meta so nothing is
 * orphaned in the options/postmeta tables. The posts themselves are left
 * untouched — they're the site's content.
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('writora_connector_token');

// Post meta written by the publish endpoint. delete_post_meta_by_key removes
// the key across all posts in one query each.
delete_post_meta_by_key('_writora_blog_id');
delete_post_meta_by_key('_writora_canonical');
delete_post_meta_by_key('_writora_featured_src');
