<?php
/**
 * Plugin Name: CDN Optimizer for WooCommerce
 * Plugin URI:  https://github.com/markgir/cdn
 * Description: Rewrites static-asset URLs (CSS, JS, images, fonts) to your CDN endpoint, dramatically speeding up WooCommerce store page loads.
 * Version:     1.0.0
 * Author:      CDN Manager — Developed by iddigital.pt
 * License:     GPL-2.0+
 * Text Domain: cdn-optimizer
 *
 * Requires at least: 5.8
 * Requires PHP:      7.4
 *
 * Credits: Developed by iddigital.pt
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'CDN_OPTIMIZER_VERSION', '1.0.0' );
define( 'CDN_OPTIMIZER_PLUGIN_FILE', __FILE__ );

// ── Activation / Deactivation ─────────────────────────────────────────────────

register_activation_hook( __FILE__, 'cdn_optimizer_activate' );
register_deactivation_hook( __FILE__, 'cdn_optimizer_deactivate' );

function cdn_optimizer_activate() {
    add_option( 'cdn_optimizer_settings', cdn_optimizer_default_settings() );
}

function cdn_optimizer_deactivate() {
    // No cleanup needed – preserve settings for reactivation.
}

function cdn_optimizer_default_settings() {
    return [
        'cdn_url'             => '',
        'enabled'             => '1',
        'rewrite_css'         => '1',
        'rewrite_js'          => '1',
        'rewrite_images'      => '1',
        'rewrite_fonts'       => '1',
        'excluded_paths'      => '',
        'relative_urls'       => '0',
    ];
}

// ── Settings page ─────────────────────────────────────────────────────────────

add_action( 'admin_menu', 'cdn_optimizer_add_menu' );

function cdn_optimizer_add_menu() {
    add_options_page(
        __( 'CDN Optimizer', 'cdn-optimizer' ),
        __( 'CDN Optimizer', 'cdn-optimizer' ),
        'manage_options',
        'cdn-optimizer',
        'cdn_optimizer_settings_page'
    );
}

add_action( 'admin_init', 'cdn_optimizer_register_settings' );

function cdn_optimizer_register_settings() {
    register_setting( 'cdn_optimizer_group', 'cdn_optimizer_settings', 'cdn_optimizer_sanitize_settings' );
}

function cdn_optimizer_sanitize_settings( $input ) {
    $defaults = cdn_optimizer_default_settings();
    $output   = [];

    $output['cdn_url'] = isset( $input['cdn_url'] )
        ? esc_url_raw( rtrim( $input['cdn_url'], '/' ) )
        : '';

    foreach ( [ 'enabled', 'rewrite_css', 'rewrite_js', 'rewrite_images', 'rewrite_fonts', 'relative_urls' ] as $bool_key ) {
        $output[ $bool_key ] = isset( $input[ $bool_key ] ) && '1' === $input[ $bool_key ] ? '1' : '0';
    }

    $output['excluded_paths'] = isset( $input['excluded_paths'] )
        ? sanitize_textarea_field( $input['excluded_paths'] )
        : '';

    return $output;
}

function cdn_optimizer_settings_page() {
    $settings = get_option( 'cdn_optimizer_settings', cdn_optimizer_default_settings() );
    ?>
    <div class="wrap">
        <h1><?php esc_html_e( 'CDN Optimizer Settings', 'cdn-optimizer' ); ?></h1>

        <?php if ( empty( $settings['cdn_url'] ) ) : ?>
            <div class="notice notice-warning"><p>
                <?php esc_html_e( 'Please enter your CDN URL to activate asset rewriting.', 'cdn-optimizer' ); ?>
            </p></div>
        <?php endif; ?>

        <form method="post" action="options.php">
            <?php settings_fields( 'cdn_optimizer_group' ); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="cdn_url"><?php esc_html_e( 'CDN URL', 'cdn-optimizer' ); ?></label></th>
                    <td>
                        <input type="url" id="cdn_url" name="cdn_optimizer_settings[cdn_url]"
                               value="<?php echo esc_attr( $settings['cdn_url'] ); ?>"
                               class="regular-text" placeholder="http://cdn.yoursite.com:3000" />
                        <p class="description">
                            <?php esc_html_e( 'The full URL of your CDN endpoint (e.g. http://cdn.yoursite.com:3000).', 'cdn-optimizer' ); ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Enable CDN', 'cdn-optimizer' ); ?></th>
                    <td>
                        <label>
                            <input type="checkbox" name="cdn_optimizer_settings[enabled]" value="1"
                                   <?php checked( '1', $settings['enabled'] ); ?> />
                            <?php esc_html_e( 'Enable CDN URL rewriting', 'cdn-optimizer' ); ?>
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e( 'Rewrite asset types', 'cdn-optimizer' ); ?></th>
                    <td>
                        <?php
                        $types = [
                            'rewrite_css'    => __( 'CSS stylesheets', 'cdn-optimizer' ),
                            'rewrite_js'     => __( 'JavaScript files', 'cdn-optimizer' ),
                            'rewrite_images' => __( 'Images (jpg, png, webp, gif, svg…)', 'cdn-optimizer' ),
                            'rewrite_fonts'  => __( 'Fonts (woff, woff2, ttf, eot)', 'cdn-optimizer' ),
                        ];
                        foreach ( $types as $key => $label ) : ?>
                            <label style="display:block;margin-bottom:4px;">
                                <input type="checkbox" name="cdn_optimizer_settings[<?php echo esc_attr( $key ); ?>]" value="1"
                                       <?php checked( '1', $settings[ $key ] ); ?> />
                                <?php echo esc_html( $label ); ?>
                            </label>
                        <?php endforeach; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="excluded_paths"><?php esc_html_e( 'Excluded paths', 'cdn-optimizer' ); ?></label></th>
                    <td>
                        <textarea id="excluded_paths" name="cdn_optimizer_settings[excluded_paths]"
                                  rows="4" class="large-text code"><?php echo esc_textarea( $settings['excluded_paths'] ); ?></textarea>
                        <p class="description">
                            <?php esc_html_e( 'One path per line. URLs containing these strings will NOT be rewritten (e.g. /wp-admin/).', 'cdn-optimizer' ); ?>
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

// ── URL rewriting ─────────────────────────────────────────────────────────────

add_action( 'template_redirect', 'cdn_optimizer_start_ob' );

function cdn_optimizer_start_ob() {
    $settings = get_option( 'cdn_optimizer_settings', cdn_optimizer_default_settings() );
    if ( empty( $settings['cdn_url'] ) || '1' !== $settings['enabled'] ) {
        return;
    }
    // Do not rewrite in admin, login, or REST API contexts.
    if ( is_admin() || ( defined( 'DOING_AJAX' ) && DOING_AJAX ) ) {
        return;
    }
    ob_start( 'cdn_optimizer_rewrite_html' );
}

function cdn_optimizer_rewrite_html( $html ) {
    $settings = get_option( 'cdn_optimizer_settings', cdn_optimizer_default_settings() );
    $cdn_url  = $settings['cdn_url'];

    if ( empty( $cdn_url ) ) {
        return $html;
    }

    $site_url = rtrim( get_site_url(), '/' );

    // Build the regex character class for supported extensions
    $ext_groups = [];
    if ( '1' === $settings['rewrite_css'] )    $ext_groups[] = 'css';
    if ( '1' === $settings['rewrite_js'] )     $ext_groups[] = 'js';
    if ( '1' === $settings['rewrite_images'] ) $ext_groups[] = 'jpg|jpeg|png|gif|webp|svg|ico|bmp|avif';
    if ( '1' === $settings['rewrite_fonts'] )  $ext_groups[] = 'woff|woff2|ttf|eot|otf';

    if ( empty( $ext_groups ) ) {
        return $html;
    }

    $ext_pattern = implode( '|', $ext_groups );

    // Match absolute URLs pointing to this site's static assets
    $pattern = '#(' . preg_quote( $site_url, '#' ) . ')((?:[^"\'>\s]*?\.(?:' . $ext_pattern . ')(?:\?[^"\'>\s]*)?)(?=["\'>]))#i';

    $excluded = array_filter( array_map( 'trim', explode( "\n", $settings['excluded_paths'] ) ) );

    $html = preg_replace_callback(
        $pattern,
        function ( $matches ) use ( $cdn_url, $excluded ) {
            $original = $matches[1] . $matches[2];
            $path     = $matches[2];

            // Skip excluded paths
            foreach ( $excluded as $excl ) {
                if ( str_contains( $path, $excl ) ) {
                    return $original;
                }
            }

            return $cdn_url . $path;
        },
        $html
    );

    return $html;
}

// ── WooCommerce specific: also rewrite product image URLs in REST responses ───

add_filter( 'woocommerce_product_get_image', 'cdn_optimizer_filter_product_image', 10, 1 );

function cdn_optimizer_filter_product_image( $html ) {
    $settings = get_option( 'cdn_optimizer_settings', cdn_optimizer_default_settings() );
    if ( empty( $settings['cdn_url'] ) || '1' !== $settings['enabled'] || '1' !== $settings['rewrite_images'] ) {
        return $html;
    }
    $site_url = rtrim( get_site_url(), '/' );
    $cdn_url  = $settings['cdn_url'];
    return str_replace( $site_url . '/wp-content/uploads', $cdn_url . '/wp-content/uploads', $html );
}
