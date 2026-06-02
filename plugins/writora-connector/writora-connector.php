<?php
/**
 * Plugin Name:       Writora Connector
 * Plugin URI:        https://writora.app
 * Description:       Receives posts published from Writora and creates/updates them on this WordPress site. One-click cross-posting with idempotent upserts, featured-image sideloading, and canonical URLs back to the original.
 * Version:           1.0.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            Writora
 * License:           GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit; // No direct access.
}

define('WRITORA_TOKEN_OPTION', 'writora_connector_token');
define('WRITORA_BLOG_ID_META', '_writora_blog_id');
define('WRITORA_CANONICAL_META', '_writora_canonical');
define('WRITORA_FEATURED_SRC_META', '_writora_featured_src');

/**
 * Generate a connection token on activation (once). The user copies this into
 * Writora; requests must present it as the X-Writora-Token header.
 */
function writora_activate() {
    if (!get_option(WRITORA_TOKEN_OPTION)) {
        writora_regenerate_token();
    }
}
register_activation_hook(__FILE__, 'writora_activate');

function writora_regenerate_token() {
    // 32 bytes hex; wp_generate_password avoids ambiguous chars but hex is fine.
    $token = bin2hex(random_bytes(32));
    update_option(WRITORA_TOKEN_OPTION, $token, false);
    return $token;
}

/**
 * REST permission callback: constant-time compare the request's token header
 * against the stored option.
 */
function writora_check_auth(WP_REST_Request $request) {
    $stored = (string) get_option(WRITORA_TOKEN_OPTION, '');
    $provided = (string) $request->get_header('x-writora-token');
    if ($stored === '' || $provided === '') {
        return new WP_Error('writora_unauthorized', 'Missing connection token', array('status' => 401));
    }
    if (!hash_equals($stored, $provided)) {
        return new WP_Error('writora_unauthorized', 'Invalid connection token', array('status' => 401));
    }
    return true;
}

add_action('rest_api_init', function () {
    register_rest_route('writora/v1', '/ping', array(
        'methods'             => 'GET',
        'permission_callback' => 'writora_check_auth',
        'callback'            => 'writora_rest_ping',
    ));
    register_rest_route('writora/v1', '/publish', array(
        'methods'             => 'POST',
        'permission_callback' => 'writora_check_auth',
        'callback'            => 'writora_rest_publish',
    ));
});

function writora_rest_ping() {
    return new WP_REST_Response(array(
        'ok'      => true,
        'site'    => get_bloginfo('name'),
        'version' => '1.0.0',
    ), 200);
}

/**
 * Create or update a post from Writora. Idempotent: keyed on the Writora blog
 * id stored in post meta, so re-publishing updates the same post.
 */
function writora_rest_publish(WP_REST_Request $request) {
    $body = $request->get_json_params();
    if (!is_array($body)) {
        return new WP_Error('writora_bad_request', 'Invalid JSON body', array('status' => 400));
    }

    $writora_blog_id = isset($body['writoraBlogId']) ? sanitize_text_field($body['writoraBlogId']) : '';
    $title           = isset($body['title']) ? sanitize_text_field($body['title']) : '';
    $html            = isset($body['html']) ? $body['html'] : '';
    if ($writora_blog_id === '' || $title === '' || $html === '') {
        return new WP_Error('writora_bad_request', 'writoraBlogId, title and html are required', array('status' => 400));
    }

    $slug         = isset($body['slug']) ? sanitize_title($body['slug']) : '';
    $excerpt      = isset($body['excerpt']) ? sanitize_text_field($body['excerpt']) : '';
    $canonical    = isset($body['canonicalUrl']) ? esc_url_raw($body['canonicalUrl']) : '';
    $featured_src = isset($body['featuredImageUrl']) ? esc_url_raw($body['featuredImageUrl']) : '';
    $category     = isset($body['category']) ? sanitize_text_field($body['category']) : '';
    $status       = (isset($body['status']) && $body['status'] === 'draft') ? 'draft' : 'publish';

    // Find an existing post previously created from this Writora blog.
    $existing = get_posts(array(
        'post_type'   => 'post',
        'post_status' => 'any',
        'meta_key'    => WRITORA_BLOG_ID_META,
        'meta_value'  => $writora_blog_id,
        'numberposts' => 1,
        'fields'      => 'ids',
    ));

    $postarr = array(
        'post_title'   => $title,
        'post_content' => $html, // Writora sends sanitized HTML.
        'post_excerpt' => $excerpt,
        'post_status'  => $status,
        'post_type'    => 'post',
    );
    if ($slug !== '') {
        $postarr['post_name'] = $slug;
    }

    if (!empty($existing)) {
        $postarr['ID'] = (int) $existing[0];
        $post_id = wp_update_post($postarr, true);
    } else {
        $post_id = wp_insert_post($postarr, true);
    }

    if (is_wp_error($post_id)) {
        return new WP_Error('writora_save_failed', $post_id->get_error_message(), array('status' => 500));
    }

    update_post_meta($post_id, WRITORA_BLOG_ID_META, $writora_blog_id);
    if ($canonical !== '') {
        update_post_meta($post_id, WRITORA_CANONICAL_META, $canonical);
    }

    if ($category !== '') {
        // wp_create_category() lives in wp-admin and isn't loaded for REST
        // requests, so use the always-available term functions instead.
        $term = term_exists($category, 'category');
        if (!$term) {
            $term = wp_insert_term($category, 'category');
        }
        if (!is_wp_error($term)) {
            $cat_id = is_array($term) ? (int) $term['term_id'] : (int) $term;
            if ($cat_id > 0) {
                wp_set_post_categories($post_id, array($cat_id));
            }
        }
    }

    // wp_http_validate_url rejects private/loopback hosts and non-http(s)
    // schemes, so a crafted featuredImageUrl can't SSRF this site.
    if ($featured_src !== '' && wp_http_validate_url($featured_src)) {
        writora_maybe_set_featured_image($post_id, $featured_src);
    }

    return new WP_REST_Response(array(
        'id'  => $post_id,
        'url' => get_permalink($post_id),
    ), 200);
}

/**
 * Sideload the featured image into the media library, but only when it changed
 * since the last publish (tracked via meta) so re-publishes don't pile up dupes.
 */
function writora_maybe_set_featured_image($post_id, $src) {
    $previous = get_post_meta($post_id, WRITORA_FEATURED_SRC_META, true);
    if ($previous === $src && has_post_thumbnail($post_id)) {
        return;
    }

    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $attachment_id = media_sideload_image($src, $post_id, null, 'id');
    if (is_wp_error($attachment_id)) {
        return; // Non-fatal: the post still publishes without a featured image.
    }
    set_post_thumbnail($post_id, $attachment_id);
    update_post_meta($post_id, WRITORA_FEATURED_SRC_META, $src);
}

/**
 * Emit a canonical link to the Writora original on single posts, so search
 * engines treat Writora as the source and don't penalise the cross-post as
 * duplicate content. Skipped when an SEO plugin already manages canonicals.
 */
add_action('wp_head', function () {
    if (!is_singular('post')) {
        return;
    }
    if (defined('WPSEO_VERSION') || defined('RANK_MATH_VERSION') || defined('SEOPRESS_VERSION')) {
        return; // Let the SEO plugin own the canonical tag.
    }
    $canonical = get_post_meta(get_queried_object_id(), WRITORA_CANONICAL_META, true);
    if ($canonical) {
        echo '<link rel="canonical" href="' . esc_url($canonical) . '" />' . "\n";
    }
}, 1);

// --- Admin settings page ----------------------------------------------------

add_action('admin_menu', function () {
    add_options_page(
        'Writora Connector',
        'Writora Connector',
        'manage_options',
        'writora-connector',
        'writora_render_settings_page'
    );
});

function writora_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    if (
        isset($_POST['writora_regenerate']) &&
        check_admin_referer('writora_regenerate_action', 'writora_regenerate_nonce')
    ) {
        writora_regenerate_token();
        echo '<div class="notice notice-success"><p>Connection token regenerated. Update it in Writora.</p></div>';
    }

    $token    = (string) get_option(WRITORA_TOKEN_OPTION, '');
    $rest_url = esc_url(rest_url('writora/v1'));
    ?>
    <div class="wrap">
        <h1>Writora Connector</h1>
        <p>Connect this site to Writora to publish posts here automatically. In Writora, add a WordPress destination and paste the values below.</p>

        <table class="form-table" role="presentation">
            <tr>
                <th scope="row"><label for="writora_site_url">Site URL</label></th>
                <td><input type="text" id="writora_site_url" class="regular-text code" readonly value="<?php echo esc_attr(home_url()); ?>" onclick="this.select()"></td>
            </tr>
            <tr>
                <th scope="row"><label for="writora_token">Connection token</label></th>
                <td>
                    <input type="text" id="writora_token" class="large-text code" readonly value="<?php echo esc_attr($token); ?>" onclick="this.select()">
                    <p class="description">Treat this like a password. Paste it into the Writora WordPress destination.</p>
                </td>
            </tr>
            <tr>
                <th scope="row">REST endpoint</th>
                <td><code><?php echo $rest_url; ?></code></td>
            </tr>
        </table>

        <form method="post">
            <?php wp_nonce_field('writora_regenerate_action', 'writora_regenerate_nonce'); ?>
            <input type="hidden" name="writora_regenerate" value="1">
            <?php submit_button('Regenerate token', 'secondary'); ?>
            <p class="description">Regenerating invalidates the old token — you'll need to update it in Writora.</p>
        </form>
    </div>
    <?php
}
