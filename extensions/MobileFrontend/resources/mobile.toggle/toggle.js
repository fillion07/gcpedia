( function ( M, $ ) {
	var context = M.require( 'mobile.context/context' ),
		settings = M.require( 'mobile.settings/settings' ),
		browser = M.require( 'mobile.browser/browser' ),
		escapeHash = M.require( 'mobile.startup/util' ).escapeHash,
		arrowUpOptions = {
			name: 'arrow-up',
			additionalClassNames: 'indicator'
		},
		arrowDownOptions = {
			name: 'arrow-down',
			additionalClassNames: 'indicator'
		},
		Icon = M.require( 'mobile.startup/Icon' );

	/**
	 * Using the settings module looks at what sections were previously expanded on
	 * existing page.
	 *
	 * @method
	 * @param {Page} page
	 * @returns {Object} representing open sections
	 * @ignore
	 */
	function getExpandedSections( page ) {
		var expandedSections = $.parseJSON(
			settings.get( 'expandedSections', false ) || '{}'
		);
		expandedSections[page.title] = expandedSections[page.title] || {};
		return expandedSections;
	}

	/**
	 * @ignore
	 * @param {Object} expandedSections
	 * Save expandedSections to localStorage
	 */
	function saveExpandedSections( expandedSections ) {
		settings.save(
			'expandedSections', JSON.stringify( expandedSections ), false
		);
	}

	/**
	 * Given an expanded heading, store it to localStorage.
	 * If the heading is collapsed, remove it from localStorage.
	 *
	 * @param {jQuery.Object} $heading - A heading belonging to a section
	 * @param {Page} page
	 * @ignore
	 */
	function storeSectionToggleState( $heading, page ) {
		var headline = $heading.find( 'span' ).attr( 'id' ),
			isSectionOpen = $heading.hasClass( 'open-block' ),
			expandedSections = getExpandedSections( page );

		if ( headline ) {
			if ( isSectionOpen ) {
				expandedSections[page.title][headline] = ( new Date() ).getTime();
			} else {
				delete expandedSections[page.title][headline];
			}

			saveExpandedSections( expandedSections );
		}
	}

	/**
	 * Expand sections that were previously expanded before leaving this page.
	 * @param {jQuery.Object} $container
	 * @param {Page} page
	 * @ignore
	 */
	function expandStoredSections( $container, page ) {
		var $sectionHeading, $headline,
			expandedSections = getExpandedSections( page ),
			$headlines = $container.find( '.section-heading span' );

		$headlines.each( function () {
			$headline = $( this );
			$sectionHeading = $headline.parents( '.section-heading' );
			// toggle only if the section is not already expanded
			if (
				expandedSections[page.title][$headline.attr( 'id' )] &&
				!$sectionHeading.hasClass( 'open-block' )
			) {
				toggle( $sectionHeading, page );
			}
		} );
	}

	/**
	 * Clean obsolete (saved more than a day ago) expanded sections from
	 * localStorage.
	 * @param {Page} page
	 * @ignore
	 */
	function cleanObsoleteStoredSections( page ) {
		var now = ( new Date() ).getTime(),
			expandedSections = getExpandedSections( page ),
			// the number of days between now and the time a setting was saved
			daysDifference;
		$.each( expandedSections, function ( page, sections ) {
			// clean the setting if it is more than a day old
			$.each( sections, function ( section, timestamp ) {
				daysDifference = Math.floor( ( now - timestamp ) / 1000 / 60 / 60 / 24 );
				if ( daysDifference >= 1 ) {
					delete expandedSections[page][section];
				}
			} );
		} );
		saveExpandedSections( expandedSections );
	}

	/**
	 * Given a heading, toggle it and any of its children
	 *
	 * @param {jQuery.Object} $heading A heading belonging to a section
	 * @ignore
	 */
	function toggle( $heading ) {
		var isCollapsed = $heading.is( '.open-block' ),
			page = $heading.data( 'page' ),
			options, indicator;

		$heading.toggleClass( 'open-block' );
		$heading.data( 'indicator' ).remove();

		options = $heading.hasClass( 'open-block' ) ? arrowUpOptions : arrowDownOptions;
		indicator = new Icon( options ).prependTo( $heading );
		$heading.data( 'indicator', indicator );

		$heading.next()
			.toggleClass( 'open-block' )
			.attr( {
				'aria-pressed': !isCollapsed,
				'aria-expanded': !isCollapsed
			} );

		if ( !browser.isWideScreen() ) {
			storeSectionToggleState( $heading, page );
		}
	}

	/**
	 * Enables toggling via enter and space keys
	 *
	 * @ignore
	 * @param {jQuery.Object} $heading
	 */
	function enableKeyboardActions( $heading ) {
		$heading.on( 'keypress', function ( ev ) {
			if ( ev.which === 13 || ev.which === 32 ) {
				// Only handle keypresses on the "Enter" or "Space" keys
				toggle( $( this ) );
			}
		} ).find( 'a' ).on( 'keypress mouseup', function ( ev ) {
			ev.stopPropagation();
		} );
	}

	/**
	 * Reveals an element and its parent section as identified by it's id
	 *
	 * @ignore
	 * @param {String} selector A css selector that identifies a single element
	 * @param {Object} $container jQuery element to search in
	 */
	function reveal( selector, $container ) {
		var $target, $heading;

		// jQuery will throw for hashes containing certain characters which can break toggling
		try {
			$target = $container.find( escapeHash( selector ) );
			$heading = $target.parents( '.collapsible-heading' );
			// The heading is not a section heading, check if in a content block!
			if ( !$heading.length ) {
				$heading = $target.parents( '.collapsible-block' ).prev( '.collapsible-heading' );
			}
			if ( $heading.length && !$heading.hasClass( 'open-block' ) ) {
				toggle( $heading );
			}
			if ( $heading.length ) {
				// scroll again after opening section (opening section makes the page longer)
				window.scrollTo( 0, $target.offset().top );
			}
		} catch ( e ) {}
	}

	/**
	 * Enables section toggling in a given container when wgMFCollapseSectionsByDefault
	 * is enabled.
	 *
	 * @method
	 * @param {jQuery.object} $container to apply toggling to
	 * @param {String} prefix a prefix to use for the id.
	 * @param {Page} page to allow storage of session for future visits
	 * @ignore
	 */
	function enable( $container, prefix, page ) {
		var tagName, expandSections, indicator,
			$firstHeading,
			collapseSectionsByDefault = mw.config.get( 'wgMFCollapseSectionsByDefault' );

		// Also allow .section-heading if some extensions like Wikibase
		// want to toggle other headlines than direct descendants of $container.
		$firstHeading = $container.find( '> h1,> h2,> h3,> h4,> h5,> h6,.section-heading' ).eq( 0 );
		tagName = $firstHeading.prop( 'tagName' ) || 'H1';

		if ( collapseSectionsByDefault === undefined ) {
			// Old default behavior if on cached output
			collapseSectionsByDefault = true;
		}
		expandSections = !collapseSectionsByDefault ||
			( context.isBetaGroupMember() && settings.get( 'expandSections', true ) === 'true' );

		$container.find( tagName ).each( function ( i ) {
			var $heading = $( this ),
				id = prefix + 'collapsible-block-' + i;
			// Be sure there is a div wrapping the section content.
			// Otherwise, collapsible sections for this page is not enabled.
			if ( $heading.next().is( 'div' ) ) {
				$heading
					.addClass( 'collapsible-heading ' )
					.data( 'page', page )
					.attr( {
						tabindex: 0,
						'aria-haspopup': 'true',
						'aria-controls': id
					} )
					.on( 'click', function ( ev ) {
						// prevent taps/clicks on edit button after toggling (bug 56209)
						ev.preventDefault();
						toggle( $( this ) );
					} );
				indicator = new Icon( arrowDownOptions ).prependTo( $heading );
				$heading.data( 'indicator', indicator );
				$heading.next( 'div' )
					.addClass( 'collapsible-block' )
					.eq( 0 )
					.attr( {
						// We need to give each content block a unique id as that's
						// the only way we can tell screen readers what element we're
						// referring to (aria-controls)
						id: id,
						'aria-pressed': 'false',
						'aria-expanded': 'false'
					} );

				enableKeyboardActions( $heading );
				if ( browser.isWideScreen() || expandSections ) {
					// Expand sections by default on wide screen devices or if the expand sections setting is set
					toggle( $heading );
				}

			}
		} );

		/**
		 * Checks the existing hash and toggles open any section that contains the fragment.
		 *
		 * @method
		 * @ignore
		 */
		function checkHash() {
			var hash = window.location.hash;
			if ( hash.indexOf( '#' ) === 0 ) {
				reveal( hash, $container );
			}
		}

		/**
		 * Checks the value of wgInternalRedirectTargetUrl and reveals the collapsed
		 * section that contains it if present
		 *
		 * @method
		 * @ignore
		 */
		function checkInternalRedirectAndHash() {
			var internalRedirect = mw.config.get( 'wgInternalRedirectTargetUrl' ),
				internalRedirectHash = internalRedirect ? internalRedirect.split( '#' )[1] : false;

			if ( internalRedirectHash ) {
				window.location.hash = internalRedirectHash;
				reveal( internalRedirectHash, $container );
			}
		}

		checkInternalRedirectAndHash();
		checkHash();
		// Restricted to links created by editors and thus outside our control
		$container.find( 'a' ).on( 'click', function () {
			// the link might be an internal link with a hash.
			// if it is check if we need to reveal any sections.
			if ( $( this ).attr( 'href' ) !== undefined &&
				$( this ).attr( 'href' ).indexOf( '#' ) > -1
			) {
				checkHash();
			}
		} );

		if ( !browser.isWideScreen() ) {
			expandStoredSections( $container, page );
			cleanObsoleteStoredSections( page );
		}
	}

	M.define( 'mobile.toggle/toggle', {
		reveal: reveal,
		toggle: toggle,
		enable: enable,
		_getExpandedSections: getExpandedSections,
		_expandStoredSections: expandStoredSections,
		_cleanObsoleteStoredSections: cleanObsoleteStoredSections
	} ).deprecate( 'toggle' );

}( mw.mobileFrontend, jQuery ) );
