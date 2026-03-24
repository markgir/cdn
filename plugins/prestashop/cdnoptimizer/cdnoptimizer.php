<?php
/**
 * CDN Optimizer module for PrestaShop 1.7 / 8.x
 *
 * Rewrites static-asset URLs in page output to point at your CDN endpoint,
 * reducing origin load and improving page-load times for PrestaShop stores.
 */

if ( ! defined( '_PS_VERSION_' ) ) {
    exit;
}

class CdnOptimizer extends Module
{
    public function __construct()
    {
        $this->name          = 'cdnoptimizer';
        $this->tab           = 'administration';
        $this->version       = '1.0.0';
        $this->author        = 'CDN Manager';
        $this->need_instance = 0;
        $this->ps_versions_compliancy = [
            'min' => '1.7.0',
            'max' => _PS_VERSION_,
        ];
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = $this->l( 'CDN Optimizer' );
        $this->description = $this->l(
            'Rewrites static asset URLs (CSS, JS, images, fonts) to your CDN endpoint for faster page loads.'
        );
        $this->confirmUninstall = $this->l( 'Are you sure you want to uninstall CDN Optimizer?' );
    }

    // ── Install / Uninstall ───────────────────────────────────────────────────

    public function install()
    {
        return parent::install()
            && $this->registerHook( 'actionOutputHTMLBefore' )
            && $this->registerHook( 'displayHeader' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_URL',           '' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_ENABLED',       '1' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_CSS',   '1' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_JS',    '1' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_IMG',   '1' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_FONTS', '1' )
            && Configuration::updateValue( 'CDN_OPTIMIZER_EXCLUDED',      '' );
    }

    public function uninstall()
    {
        foreach (
            [
                'CDN_OPTIMIZER_URL', 'CDN_OPTIMIZER_ENABLED',
                'CDN_OPTIMIZER_REWRITE_CSS', 'CDN_OPTIMIZER_REWRITE_JS',
                'CDN_OPTIMIZER_REWRITE_IMG', 'CDN_OPTIMIZER_REWRITE_FONTS',
                'CDN_OPTIMIZER_EXCLUDED',
            ] as $key
        ) {
            Configuration::deleteByName( $key );
        }
        return parent::uninstall();
    }

    // ── Configuration page ────────────────────────────────────────────────────

    public function getContent()
    {
        $output = '';

        if ( Tools::isSubmit( 'submitCdnOptimizer' ) ) {
            $cdn_url = rtrim( Tools::getValue( 'CDN_OPTIMIZER_URL' ), '/' );
            if ( ! empty( $cdn_url ) && ! Validate::isUrl( $cdn_url ) ) {
                $output .= $this->displayError( $this->l( 'Invalid CDN URL.' ) );
            } else {
                Configuration::updateValue( 'CDN_OPTIMIZER_URL',           $cdn_url );
                Configuration::updateValue( 'CDN_OPTIMIZER_ENABLED',       Tools::getValue( 'CDN_OPTIMIZER_ENABLED' )       ? '1' : '0' );
                Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_CSS',   Tools::getValue( 'CDN_OPTIMIZER_REWRITE_CSS' )   ? '1' : '0' );
                Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_JS',    Tools::getValue( 'CDN_OPTIMIZER_REWRITE_JS' )    ? '1' : '0' );
                Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_IMG',   Tools::getValue( 'CDN_OPTIMIZER_REWRITE_IMG' )   ? '1' : '0' );
                Configuration::updateValue( 'CDN_OPTIMIZER_REWRITE_FONTS', Tools::getValue( 'CDN_OPTIMIZER_REWRITE_FONTS' ) ? '1' : '0' );
                Configuration::updateValue( 'CDN_OPTIMIZER_EXCLUDED',      Tools::getValue( 'CDN_OPTIMIZER_EXCLUDED' ) );
                $output .= $this->displayConfirmation( $this->l( 'Settings saved.' ) );
            }
        }

        return $output . $this->renderForm();
    }

    protected function renderForm()
    {
        $helper             = new HelperForm();
        $helper->show_toolbar = false;
        $helper->table      = $this->table;
        $helper->module     = $this;
        $helper->default_form_language    = $this->context->language->id;
        $helper->allow_employee_form_lang = Configuration::get( 'PS_BO_ALLOW_EMPLOYEE_FORM_LANG', 0 );
        $helper->identifier  = $this->identifier;
        $helper->submit_action = 'submitCdnOptimizer';
        $helper->currentIndex  = $this->context->link->getAdminLink( 'AdminModules', false )
            . '&configure=' . $this->name . '&tab_module=' . $this->tab . '&module_name=' . $this->name;
        $helper->token         = Tools::getAdminTokenLite( 'AdminModules' );

        $helper->tpl_vars = [
            'fields_value' => $this->getConfigFieldsValues(),
            'languages'    => $this->context->controller->getLanguages(),
            'id_language'  => $this->context->language->id,
        ];

        return $helper->generateForm( [ $this->getFormConfig() ] );
    }

    protected function getFormConfig()
    {
        return [
            'form' => [
                'legend' => [
                    'title' => $this->l( 'CDN Optimizer Settings' ),
                    'icon'  => 'icon-cogs',
                ],
                'input' => [
                    [
                        'type'     => 'text',
                        'label'    => $this->l( 'CDN URL' ),
                        'name'     => 'CDN_OPTIMIZER_URL',
                        'required' => false,
                        'desc'     => $this->l( 'Full URL of your CDN endpoint, e.g. http://cdn.yoursite.com:3000' ),
                    ],
                    [
                        'type'   => 'switch',
                        'label'  => $this->l( 'Enable CDN' ),
                        'name'   => 'CDN_OPTIMIZER_ENABLED',
                        'values' => [ [ 'id' => 'on', 'value' => 1, 'label' => $this->l( 'Enabled' ) ], [ 'id' => 'off', 'value' => 0, 'label' => $this->l( 'Disabled' ) ] ],
                    ],
                    [
                        'type'   => 'switch',
                        'label'  => $this->l( 'Rewrite CSS' ),
                        'name'   => 'CDN_OPTIMIZER_REWRITE_CSS',
                        'values' => [ [ 'id' => 'on', 'value' => 1, 'label' => $this->l( 'Yes' ) ], [ 'id' => 'off', 'value' => 0, 'label' => $this->l( 'No' ) ] ],
                    ],
                    [
                        'type'   => 'switch',
                        'label'  => $this->l( 'Rewrite JavaScript' ),
                        'name'   => 'CDN_OPTIMIZER_REWRITE_JS',
                        'values' => [ [ 'id' => 'on', 'value' => 1, 'label' => $this->l( 'Yes' ) ], [ 'id' => 'off', 'value' => 0, 'label' => $this->l( 'No' ) ] ],
                    ],
                    [
                        'type'   => 'switch',
                        'label'  => $this->l( 'Rewrite Images' ),
                        'name'   => 'CDN_OPTIMIZER_REWRITE_IMG',
                        'values' => [ [ 'id' => 'on', 'value' => 1, 'label' => $this->l( 'Yes' ) ], [ 'id' => 'off', 'value' => 0, 'label' => $this->l( 'No' ) ] ],
                    ],
                    [
                        'type'   => 'switch',
                        'label'  => $this->l( 'Rewrite Fonts' ),
                        'name'   => 'CDN_OPTIMIZER_REWRITE_FONTS',
                        'values' => [ [ 'id' => 'on', 'value' => 1, 'label' => $this->l( 'Yes' ) ], [ 'id' => 'off', 'value' => 0, 'label' => $this->l( 'No' ) ] ],
                    ],
                    [
                        'type'     => 'textarea',
                        'label'    => $this->l( 'Excluded paths (one per line)' ),
                        'name'     => 'CDN_OPTIMIZER_EXCLUDED',
                        'required' => false,
                        'desc'     => $this->l( 'URLs containing these strings will NOT be rewritten.' ),
                    ],
                ],
                'submit' => [
                    'title' => $this->l( 'Save' ),
                ],
            ],
        ];
    }

    protected function getConfigFieldsValues()
    {
        return [
            'CDN_OPTIMIZER_URL'           => Configuration::get( 'CDN_OPTIMIZER_URL' ),
            'CDN_OPTIMIZER_ENABLED'       => Configuration::get( 'CDN_OPTIMIZER_ENABLED' ),
            'CDN_OPTIMIZER_REWRITE_CSS'   => Configuration::get( 'CDN_OPTIMIZER_REWRITE_CSS' ),
            'CDN_OPTIMIZER_REWRITE_JS'    => Configuration::get( 'CDN_OPTIMIZER_REWRITE_JS' ),
            'CDN_OPTIMIZER_REWRITE_IMG'   => Configuration::get( 'CDN_OPTIMIZER_REWRITE_IMG' ),
            'CDN_OPTIMIZER_REWRITE_FONTS' => Configuration::get( 'CDN_OPTIMIZER_REWRITE_FONTS' ),
            'CDN_OPTIMIZER_EXCLUDED'      => Configuration::get( 'CDN_OPTIMIZER_EXCLUDED' ),
        ];
    }

    // ── Hooks ─────────────────────────────────────────────────────────────────

    /**
     * PS 1.7.7+ / PS 8: rewrite HTML output before sending to browser.
     */
    public function hookActionOutputHTMLBefore( array $params )
    {
        if ( ! $this->isActive() ) {
            return;
        }
        $params['html'] = $this->rewriteHtml( $params['html'] );
    }

    /**
     * Fallback for older PrestaShop versions via output buffering.
     */
    public function hookDisplayHeader()
    {
        if ( ! $this->isActive() || $this->context->controller->php_self === 'order' ) {
            return;
        }
        ob_start( [ $this, 'rewriteHtml' ] );
    }

    // ── URL rewriting ─────────────────────────────────────────────────────────

    protected function isActive()
    {
        return Configuration::get( 'CDN_OPTIMIZER_ENABLED' ) === '1'
            && ! empty( Configuration::get( 'CDN_OPTIMIZER_URL' ) );
    }

    public function rewriteHtml( $html )
    {
        $cdn_url  = rtrim( Configuration::get( 'CDN_OPTIMIZER_URL' ), '/' );
        $shop_url = rtrim( Tools::getShopDomainSsl( true ), '/' );

        $ext_groups = [];
        if ( Configuration::get( 'CDN_OPTIMIZER_REWRITE_CSS' )   === '1' ) $ext_groups[] = 'css';
        if ( Configuration::get( 'CDN_OPTIMIZER_REWRITE_JS' )    === '1' ) $ext_groups[] = 'js';
        if ( Configuration::get( 'CDN_OPTIMIZER_REWRITE_IMG' )   === '1' ) $ext_groups[] = 'jpg|jpeg|png|gif|webp|svg|ico|bmp|avif';
        if ( Configuration::get( 'CDN_OPTIMIZER_REWRITE_FONTS' ) === '1' ) $ext_groups[] = 'woff|woff2|ttf|eot|otf';

        if ( empty( $ext_groups ) ) {
            return $html;
        }

        $ext_pattern = implode( '|', $ext_groups );
        $pattern     = '#(' . preg_quote( $shop_url, '#' ) . ')((?:[^"\'>\s]*?\.(?:' . $ext_pattern . ')(?:\?[^"\'>\s]*)?)(?=["\'>]))#i';

        $excluded_raw = Configuration::get( 'CDN_OPTIMIZER_EXCLUDED' );
        $excluded     = array_filter( array_map( 'trim', explode( "\n", $excluded_raw ) ) );

        return preg_replace_callback(
            $pattern,
            function ( $matches ) use ( $cdn_url, $excluded ) {
                $path = $matches[2];
                foreach ( $excluded as $excl ) {
                    if ( strpos( $path, $excl ) !== false ) {
                        return $matches[1] . $path;
                    }
                }
                return $cdn_url . $path;
            },
            $html
        );
    }
}
