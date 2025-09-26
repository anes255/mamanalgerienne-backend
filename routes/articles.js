const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Import models only if they exist
let Article, Comment;
try {
  Article = require('../models/Article');
  Comment = require('../models/Comment');
} catch (error) {
  console.log('Article models not found, using fallback');
}

// Import middleware only if it exists
let auth, adminAuth, optionalAuth;
try {
  const authMiddleware = require('../middleware/auth');
  auth = authMiddleware.auth;
  adminAuth = authMiddleware.adminAuth;
  optionalAuth = authMiddleware.optionalAuth;
} catch (error) {
  console.log('Auth middleware not found, using fallback');
  auth = (req, res, next) => {
    req.user = { _id: 'test-user', isAdmin: false };
    next();
  };
  adminAuth = (req, res, next) => {
    req.user = { _id: 'test-admin', isAdmin: true };
    next();
  };
  optionalAuth = (req, res, next) => {
    req.user = null;
    next();
  };
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/articles/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'article-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Sample articles for fallback
const sampleArticles = [
  {
    _id: '1',
    title: 'نصائح للأمهات الجدد: كيفية التعامل مع المولود الجديد',
    content: 'مرحباً بك في عالم الأمومة الجميل! إن قدوم مولود جديد يجلب معه الكثير من الفرح والسعادة، ولكن أيضاً قد يصاحبه بعض التحديات والقلق، خاصة للأمهات اللاتي يخضن هذه التجربة لأول مرة...',
    excerpt: 'دليل شامل للأمهات الجدد يتضمن نصائح عملية للتعامل مع المولود الجديد وتنظيم الوقت',
    category: 'حملي',
    author: {
      _id: 'admin',
      name: 'د. فاطمة أحمد',
      avatar: null
    },
    images: [],
    views: 245,
    likes: [],
    featured: true,
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: '2',
    title: 'وصفات صحية ولذيذة للأطفال: أفكار متجددة لوجبات مغذية',
    content: 'التغذية السليمة للأطفال هي حجر الأساس لنموهم الصحي والسليم. في هذا المقال، سنقدم لك مجموعة من الوصفات الصحية واللذيذة التي ستساعدك في تحضير وجبات متوازنة ومفيدة لأطفالك...',
    excerpt: 'مجموعة متنوعة من الوصفات الصحية التي يحبها الأطفال مع نصائح للتغذية السليمة',
    category: 'كوزينتي',
    author: {
      _id: 'admin',
      name: 'الشيف سارة محمد',
      avatar: null
    },
    images: [],
    views: 189,
    likes: [],
    featured: true,
    published: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: '3',
    title: 'تنظيم المنزل مع وجود الأطفال: استراتيجيات عملية',
    content: 'الحفاظ على نظافة وتنظيم المنزل مع وجود الأطفال قد يبدو مهمة مستحيلة أحياناً، ولكن مع بعض الاستراتيجيات الذكية والخطط العملية، يمكنك تحقيق التوازن بين رعاية الأطفال والحفاظ على منزل مرتب...',
    excerpt: 'نصائح عملية وحلول مبتكرة لإدارة المنزل والحفاظ على النظافة مع وجود الأطفال',
    category: 'بيتي',
    author: {
      _id: 'admin',
      name: 'نور الهدى',
      avatar: null
    },
    images: [],
    views: 167,
    likes: [],
    featured: false,
    published: true,
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: '4',
    title: 'صحة الطفل في الشتاء: كيفية الوقاية من الأمراض الموسمية',
    content: 'مع قدوم فصل الشتاء، تزداد احتمالية إصابة الأطفال بنزلات البرد والإنفلونزا والأمراض التنفسية الأخرى. كأم، من المهم أن تعرفي كيفية حماية طفلك من هذه الأمراض الموسمية...',
    excerpt: 'دليل شامل للوقاية من أمراض الشتاء عند الأطفال مع نصائح طبية مهمة',
    category: 'صحتي',
    author: {
      _id: 'admin',
      name: 'د. أمينة بن علي',
      avatar: null
    },
    images: [],
    views: 134,
    likes: [],
    featured: false,
    published: true,
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    _id: '5',
    title: 'أسماء الأطفال الجزائرية التراثية ومعانيها الجميلة',
    content: 'اختيار اسم للمولود الجديد من أهم القرارات التي يتخذها الوالدان. في هذا المقال، سنستعرض مجموعة من الأسماء الجزائرية التراثية الجميلة ومعانيها، والتي تحمل في طياتها تاريخ وثقافة بلدنا الحبيب...',
    excerpt: 'مجموعة مختارة من الأسماء الجزائرية التراثية للذكور والإناث مع شرح معانيها',
    category: 'الاسماء',
    author: {
      _id: 'admin',
      name: 'أستاذة خديجة',
      avatar: null
    },
    images: [],
    views: 98,
    likes: [],
    featured: false,
    published: true,
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
  }
];

// Get all articles
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const featured = req.query.featured === 'true';
    const search = req.query.search;
    const category = req.query.category;

    if (!Article) {
      // Fallback with sample data
      let filteredArticles = [...sampleArticles];
      
      if (featured) {
        filteredArticles = filteredArticles.filter(article => article.featured);
      }
      
      if (search) {
        const searchRegex = new RegExp(search, 'i');
        filteredArticles = filteredArticles.filter(article => 
          searchRegex.test(article.title) || searchRegex.test(article.content)
        );
      }
      
      if (category) {
        filteredArticles = filteredArticles.filter(article => article.category === category);
      }

      const paginatedArticles = filteredArticles.slice(skip, skip + limit);

      return res.json({
        articles: paginatedArticles,
        pagination: {
          current: page,
          pages: Math.ceil(filteredArticles.length / limit),
          total: filteredArticles.length
        }
      });
    }

    let query = { published: true };
    
    if (featured) {
      query.featured = true;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }

    const articles = await Article.find(query)
      .populate('author', 'name avatar')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments(query);

    res.json({
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get articles error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقالات' });
  }
});

// Get single article
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (!Article) {
      // Fallback with sample data
      const article = sampleArticles.find(a => a._id === req.params.id);
      if (!article) {
        return res.status(404).json({ message: 'المقال غير موجود' });
      }
      return res.json(article);
    }

    const article = await Article.findById(req.params.id)
      .populate('author', 'name avatar');
    
    if (!article || !article.published) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    // Increment views if not the author
    if (!req.user || article.author._id.toString() !== req.user._id.toString()) {
      article.views = (article.views || 0) + 1;
      await article.save();
    }

    res.json(article);
  } catch (error) {
    console.error('Get article error:', error);
    res.status(500).json({ message: 'خطأ في جلب المقال' });
  }
});

// Get articles by category
router.get('/category/:category', optionalAuth, async (req, res) => {
  try {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!Article) {
      // Fallback with sample data
      const filteredArticles = sampleArticles.filter(article => article.category === category);
      const paginatedArticles = filteredArticles.slice(skip, skip + limit);

      return res.json({
        articles: paginatedArticles,
        pagination: {
          current: page,
          pages: Math.ceil(filteredArticles.length / limit),
          total: filteredArticles.length
        }
      });
    }

    const query = {
      category,
      published: true
    };

    const articles = await Article.find(query)
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Article.countDocuments(query);

    res.json({
      articles,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get articles by category error:', error);
    res.status(500).json({ message: 'خطأ في جلب مقالات القسم' });
  }
});

// Create new article (Admin only)
router.post('/', adminAuth, upload.array('images', 10), async (req, res) => {
  try {
    const { title, content, excerpt, category, featured, published } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'العنوان والمحتوى مطلوبان' });
    }

    if (!Article) {
      return res.status(503).json({ message: 'خدمة المقالات غير متاحة حالياً' });
    }

    const images = req.files ? req.files.map(file => file.filename) : [];

    const article = new Article({
      title,
      content,
      excerpt: excerpt || content.substring(0, 200) + '...',
      category: category || 'عام',
      author: req.user._id,
      images,
      featured: featured === 'true',
      published: published !== 'false' // Default to true unless explicitly false
    });

    await article.save();
    await article.populate('author', 'name avatar');

    res.status(201).json({
      message: 'تم إنشاء المقال بنجاح',
      article
    });
  } catch (error) {
    console.error('Create article error:', error);
    res.status(500).json({ message: 'خطأ في إنشاء المقال' });
  }
});

// Update article (Admin only)
router.put('/:id', adminAuth, upload.array('images', 10), async (req, res) => {
  try {
    if (!Article) {
      return res.status(503).json({ message: 'خدمة المقالات غير متاحة حالياً' });
    }

    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    const { title, content, excerpt, category, featured, published } = req.body;

    // Update fields
    if (title) article.title = title;
    if (content) article.content = content;
    if (excerpt) article.excerpt = excerpt;
    if (category) article.category = category;
    if (featured !== undefined) article.featured = featured === 'true';
    if (published !== undefined) article.published = published === 'true';

    // Handle new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => file.filename);
      article.images = [...(article.images || []), ...newImages];
    }

    await article.save();
    await article.populate('author', 'name avatar');

    res.json({
      message: 'تم تحديث المقال بنجاح',
      article
    });
  } catch (error) {
    console.error('Update article error:', error);
    res.status(500).json({ message: 'خطأ في تحديث المقال' });
  }
});

// Delete article (Admin only)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    if (!Article) {
      return res.status(503).json({ message: 'خدمة المقالات غير متاحة حالياً' });
    }

    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    // Delete associated images
    if (article.images && article.images.length > 0) {
      article.images.forEach(image => {
        const imagePath = path.join(__dirname, '..', 'uploads', 'articles', image);
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
            console.log(`Deleted image: ${imagePath}`);
          } catch (err) {
            console.error(`Error deleting image ${imagePath}:`, err);
          }
        }
      });
    }

    // Delete all comments associated with this article
    let deletedComments = 0;
    if (Comment) {
      const deleteResult = await Comment.deleteMany({ 
        targetType: 'Article', 
        targetId: article._id 
      });
      deletedComments = deleteResult.deletedCount;
    }

    // Delete the article
    await Article.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'تم حذف المقال بنجاح',
      deletedComments
    });
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).json({ message: 'خطأ في حذف المقال' });
  }
});

// Like/Unlike article
router.post('/:id/like', auth, async (req, res) => {
  try {
    if (!Article) {
      return res.status(503).json({ message: 'خدمة المقالات غير متاحة حالياً' });
    }

    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'المقال غير موجود' });
    }

    const userIndex = article.likes.indexOf(req.user._id);
    
    if (userIndex > -1) {
      // Unlike
      article.likes.splice(userIndex, 1);
    } else {
      // Like
      article.likes.push(req.user._id);
    }

    await article.save();

    res.json({
      message: userIndex > -1 ? 'تم إلغاء الإعجاب' : 'تم الإعجاب بالمقال',
      likesCount: article.likes.length,
      isLiked: userIndex === -1
    });
  } catch (error) {
    console.error('Like article error:', error);
    res.status(500).json({ message: 'خطأ في الإعجاب بالمقال' });
  }
});

module.exports = router;
