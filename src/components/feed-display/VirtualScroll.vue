<!--
  - Copyright (c) 2022. The Nextcloud Bookmarks contributors.
  -
  - This file is licensed under the Affero General Public License version 3 or later. See the COPYING file.
  -->
<script>
import _ from 'lodash'
import { defineComponent, Fragment, h } from 'vue'
import { DISPLAY_MODE, ITEM_HEIGHT } from '../../enums/index.ts'
import { ACTIONS } from '../../store/index.ts'
import { getOldestFirst } from '../../utils/itemFilter.ts'

const GRID_ITEM_HEIGHT = 200 + 10

export default defineComponent({
	name: 'VirtualScroll',
	props: {
		/**
		 * The name of the view e.g. all, unread, feed-10
		 */
		fetchKey: {
			type: String,
			required: true,
		},
	},

	emits: {
		'load-more': () => true,
	},

	data() {
		return {
			viewport: null,
			scrollTop: 0,
			debouncedMarkRead: null,
		}
	},

	computed: {
		reachedEnd: {
			cache: false,
			get() {
				return this.$store.state.items.allItemsLoaded[this.fetchKey] === true
			},
		},

		fetching: {
			cache: false,
			get() {
				return this.$store.state.items.fetchingItems[this.fetchKey]
			},
		},

		displayMode: {
			cache: false,
			get() {
				return this.$store.getters.displaymode
			},
		},

		rowHeight() {
			return this.displayMode === DISPLAY_MODE.COMPACT ? ITEM_HEIGHT.COMPACT : ITEM_HEIGHT.DEFAULT
		},
	},

	watch: {
		fetchKey: {
			handler() {
				this.scrollTop = 0
				this._seenItems = new Map()
			},

			immediate: true,
		},

		reachedEnd: {
			handler() {
				/*
				 * When sorting oldest to newest show new items when they arrive
				 */
				const oldestFirst = getOldestFirst(this.$store, this.fetchKey)
				if (oldestFirst && !this.reachedEnd) {
					this.loadMore()
				}
			},
		},
	},

	created() {
		this._lastRendered = null
		this._lowerPaddingItems = 0
		this.debouncedMarkRead = _.debounce(this.markReadOnScroll, 500)
	},

	mounted() {
		this.loadMore()
		this.$nextTick(() => {
			if (this.$el && this.$el.getBoundingClientRect) {
				this.viewport = this.$el.getBoundingClientRect()
			}
		})

		window.addEventListener('resize', this.onScroll)
	},

	unmounted() {
		this.debouncedMarkRead.flush?.()
		this.debouncedMarkRead.cancel?.()
		window.removeEventListener('resize', this.onScroll)
	},

	updated() {
		this.$el.scrollTop = this.scrollTop
		this.$nextTick(this.loadMore)
		if (!this.$store.getters.preventReadOnScroll && !this.fetching) {
			this.addToSeen(this._lastRendered)
		}
	},

	methods: {
		addToSeen(children) {
			if (this.$el.offsetParent && children) {
				children.forEach((child) => {
					if (child.el && !this._seenItems.has(child.key) && child.props.item) {
						this._seenItems.set(child.key, { offset: child.el.offsetTop, item: child.props.item })
					}
				})
			}
		},

		markReadOnScroll() {
			for (const [key, value] of this._seenItems) {
				if (this.scrollTop > value.offset) {
					const item = value.item
					if (!item.keepUnread && item.unread) {
						this.$store.dispatch(ACTIONS.MARK_READ, { item })
					}
					this._seenItems.delete(key)
				}
			}
		},

		onScroll() {
			this.scrollTop = this.$el.scrollTop
			this.loadMore()

			if (!this.$store.getters.preventReadOnScroll) {
				this.debouncedMarkRead()
			}
		},

		loadMore() {
			if (this._lowerPaddingItems === 0) {
				if (!this.reachedEnd && !this.fetching) {
					this.$emit('load-more')
				}
			}
		},

		scrollToItem(currentIndex) {
			this.$nextTick(() => {
				/*
				 * restore view port when closing details view
				 */
				if (this.$el.scrollHeight > 0 && this.viewport.height === 0) {
					this.viewport = this.$el.getBoundingClientRect()
				}
				/*
				 * set scroll position to current item
				*/
				this.scrollTop = this.rowHeight * currentIndex
			})
		},
	},

	render() {
		let children = []
		let renderedItems = 0
		let upperPaddingItems = 0
		let lowerPaddingItems = 0
		const itemHeight = this.rowHeight
		const padding = GRID_ITEM_HEIGHT
		if (this.$slots.default && this.viewport) {
			const childComponents = []

			const findComponents = (vnodes, childComponents) => {
				vnodes.forEach((vnode) => {
					if (vnode.type?.name?.startsWith('FeedItem')) {
						childComponents.push(vnode)
						return
					}
					if (vnode.type === Fragment) {
						findComponents(vnode.children, childComponents)
					}
				})
			}
			findComponents(this.$slots.default?.(), childComponents)

			renderedItems = Math.floor((this.viewport.height + padding + padding) / itemHeight)
			upperPaddingItems = Math.floor(Math.max(this.scrollTop - padding, 0) / itemHeight)
			children = childComponents.slice(upperPaddingItems, upperPaddingItems + renderedItems)
			renderedItems = children.length
			lowerPaddingItems = Math.max(childComponents.length - upperPaddingItems - renderedItems, 0)
			this._lowerPaddingItems = lowerPaddingItems
			this._lastRendered = children
		} else {
			return h('div', { class: 'virtual-scroll' })
		}

		return h('div', {
			class: 'virtual-scroll',
			onScroll: this.onScroll,
		}, [
			h('div', { class: 'upper-padding', style: { height: Math.max((upperPaddingItems) * itemHeight, 0) + 'px' } }),
			h('div', {
				class: 'container-window',
				style: { height: Math.max((renderedItems) * itemHeight, 0) + 'px' },
				attrs: { role: 'feed' },
			}, children),
			h('div', { class: 'lower-padding', style: { height: Math.max((lowerPaddingItems) * itemHeight, 0) + 'px' } }),
		])
	},
})
</script>

<style scoped>
.virtual-scroll {
	height: calc(100vh - 50px - 50px - 10px);
	position: relative;
	overflow-y: scroll;
}

.container-window::after {
	content: '';
	display: block;
	/* Subtract the height of the Nextcloud and Feed header. */
	height: calc(100vh - 50px - 54px);
	background-repeat: no-repeat;
}
</style>
